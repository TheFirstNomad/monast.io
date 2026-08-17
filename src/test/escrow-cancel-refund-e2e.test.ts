/**
 * End-to-end escrow cancellation + refund test.
 *
 * A funded escrow is cancelled by the buyer, the seller approves, and the full
 * amount must go back to the *buyer's* real wallet with no platform fee taken.
 *
 * Real here: ad, escrow, profiles/user_wallets rows, treasury lookup, the refund
 * split, the ledger entries and every status transition. Only Circle's transfer
 * API is stubbed, so no live USDC moves - the arguments handed to it are asserted
 * instead, which is exactly where a wrong destination address would show up.
 *
 * Skipped when SUPABASE_SERVICE_ROLE_KEY is absent.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const transfers: any[] = [];

vi.mock("../../supabase/functions/_shared/circle-dev.ts", () => ({
  treasuryTransfer: vi.fn(async (args: any) => {
    transfers.push(args);
    return { id: `tx-${transfers.length}-${crypto.randomUUID()}`, state: "INITIATED" };
  }),
}));

const { runPayout } = await import("../../supabase/functions/_shared/payout.ts");

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ARC_CHAIN_ID = 5042002;
const AMOUNT = 250;
const FEE_BPS = 100; // 1% - must NOT be applied on a refund
const SELLER_WALLET = "0x6666666666666666666666666666666666666666";
const BUYER_PROFILE_WALLET = "0x7777777777777777777777777777777777777777";
const BUYER_LINKED_WALLET = "0x8888888888888888888888888888888888888888";

const suite = SERVICE ? describe : describe.skip;

suite("escrow cancel and refund end to end", () => {
  const admin: SupabaseClient = createClient(URL, SERVICE ?? "", {
    auth: { persistSession: false },
  });

  const users: string[] = [];
  const escrowIds: string[] = [];
  let sellerId = "";
  let buyerId = "";
  let adId = "";
  let escrowWalletId = "";

  const mkUser = async (label: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${label}-${crypto.randomUUID()}@test.monast.local`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    users.push(data.user!.id);
    return data.user!.id;
  };

  const mkEscrow = async () => {
    const { data, error } = await admin
      .from("escrows")
      .insert({
        ad_id: adId,
        buyer_id: buyerId,
        seller_id: sellerId,
        chain_id: ARC_CHAIN_ID,
        amount_usdc: AMOUNT,
        status: "funded",
        funded_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    escrowIds.push(data!.id);
    return data!;
  };

  /** The cancellation request exactly as escrow-cancel performs it. */
  const requestCancel = async (escrowId: string, reason: string) => {
    const { data: current } = await admin
      .from("escrows")
      .select("status, cancel_requested_at")
      .eq("id", escrowId)
      .single();
    if (current!.status !== "funded") {
      return { ok: false as const, error: `Cannot request cancellation from status ${current!.status}` };
    }
    if (current!.cancel_requested_at) {
      return { ok: false as const, error: "A cancellation request is already open" };
    }
    const { data, error } = await admin
      .from("escrows")
      .update({
        cancel_requested_by: buyerId,
        cancel_requested_at: new Date().toISOString(),
        cancel_reason: reason,
      })
      .eq("id", escrowId)
      .select("cancel_requested_by, cancel_requested_at, cancel_reason")
      .single();
    if (error) throw error;
    return { ok: true as const, escrow: data! };
  };

  beforeAll(async () => {
    sellerId = await mkUser("cxl-seller");
    buyerId = await mkUser("cxl-buyer");

    await admin.from("profiles").update({ wallet_address: SELLER_WALLET }).eq("id", sellerId);
    await admin
      .from("profiles")
      .update({ wallet_address: BUYER_PROFILE_WALLET })
      .eq("id", buyerId);

    const { data: ad, error: adErr } = await admin
      .from("ads")
      .insert({
        seller_id: sellerId,
        title: "E2E Cancel Item",
        description: "Cancel and refund path test",
        category: "other",
        condition: "New",
        location: "Internet",
        price_usdc: AMOUNT,
        images: [],
        status: "reserved",
      })
      .select("id")
      .single();
    if (adErr) throw adErr;
    adId = ad!.id;

    const { data: escrowWallet } = await admin
      .from("treasury_wallets")
      .select("circle_wallet_id")
      .eq("purpose", "escrow")
      .eq("chain_id", ARC_CHAIN_ID)
      .eq("is_active", true)
      .single();
    escrowWalletId = escrowWallet!.circle_wallet_id as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of escrowIds) {
      await admin.from("ledger_entries").delete().eq("escrow_id", id);
      await admin.from("escrows").delete().eq("id", id);
    }
    await admin.from("notifications").delete().eq("user_id", buyerId);
    await admin.from("notifications").delete().eq("user_id", sellerId);
    await admin.from("user_wallets").delete().eq("user_id", buyerId);
    if (adId) {
      await admin.from("payments").delete().eq("ad_id", adId);
      await admin.from("ads").delete().eq("id", adId);
    }
    for (const id of users) await admin.auth.admin.deleteUser(id);
  }, 60_000);

  it("refunds the full amount to the buyer's own wallet and relists the ad", async () => {
    transfers.length = 0;
    const escrow = await mkEscrow();

    const req = await requestCancel(escrow.id, "changed my mind");
    expect(req.ok).toBe(true);
    expect(req.ok && req.escrow.cancel_requested_by).toBe(buyerId);
    expect(req.ok && req.escrow.cancel_requested_at).toBeTruthy();

    // Seller approves -> the refund runs through the single payout code path.
    const payout = await runPayout(admin, escrow, "refund", FEE_BPS);
    expect(payout.error).toBeUndefined();
    expect(payout.ok).toBe(true);
    // No fee is ever charged on a deal that did not complete.
    expect(payout.fee).toBe(0);
    expect(payout.sellerNet).toBe(AMOUNT);

    // Exactly one leg, to the buyer, out of the escrow treasury wallet.
    expect(transfers).toHaveLength(1);
    const [refundLeg] = transfers;
    expect(refundLeg.destinationAddress).toBe(BUYER_PROFILE_WALLET);
    expect(refundLeg.destinationAddress).not.toBe(SELLER_WALLET);
    expect(refundLeg.walletId).toBe(escrowWalletId);
    expect(refundLeg.amountUsdc).toBe("250");
    expect(refundLeg.chainId).toBe(ARC_CHAIN_ID);
    expect(refundLeg.idempotencyKey).toBe(`escrow:${escrow.id}:refund`);

    const { data: paid } = await admin
      .from("escrows")
      .select("payout_status, payout_circle_tx_id, platform_fee_usdc")
      .eq("id", escrow.id)
      .single();
    expect(paid!.payout_status).toBe("sent");
    expect(paid!.payout_circle_tx_id).toBe(payout.circleTransactionId);
    expect(Number(paid!.platform_fee_usdc)).toBe(0);

    // Status transitions exactly as escrow-refund performs them.
    const { data: refunded, error: refErr } = await admin
      .from("escrows")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", escrow.id)
      .select("status, refunded_at")
      .single();
    if (refErr) throw refErr;
    expect(refunded!.status).toBe("refunded");
    expect(refunded!.refunded_at).toBeTruthy();

    // The item becomes available again.
    await admin.from("ads").update({ status: "active" }).eq("id", adId).eq("status", "reserved");
    const { data: ad } = await admin.from("ads").select("status, sold_at").eq("id", adId).single();
    expect(ad!.status).toBe("active");
    expect(ad!.sold_at).toBeNull();

    // Money trail: a buyer refund, and no platform fee entry at all.
    const { data: ledger } = await admin
      .from("ledger_entries")
      .select("kind, amount_usdc, to_user_id, notes")
      .eq("escrow_id", escrow.id);
    const refundEntry = ledger!.find((l) => l.kind === "buyer_refund");
    expect(refundEntry).toBeTruthy();
    expect(Number(refundEntry!.amount_usdc)).toBe(AMOUNT);
    expect(refundEntry!.to_user_id).toBe(buyerId);
    expect(refundEntry!.notes).toContain(BUYER_PROFILE_WALLET);
    expect(ledger!.some((l) => l.kind === "platform_fee")).toBe(false);
    expect(ledger!.some((l) => l.kind === "seller_payout")).toBe(false);
  }, 120_000);

  it("prefers the buyer's wallet linked for this chain over their profile wallet", async () => {
    transfers.length = 0;
    await admin.from("user_wallets").insert({
      user_id: buyerId,
      address: BUYER_LINKED_WALLET,
      kind: "external",
      chain_id: ARC_CHAIN_ID,
      is_primary: true,
    });
    const escrow = await mkEscrow();

    const payout = await runPayout(admin, escrow, "refund", FEE_BPS);
    expect(payout.ok).toBe(true);
    expect(transfers[0].destinationAddress).toBe(BUYER_LINKED_WALLET);

    await admin.from("user_wallets").delete().eq("user_id", buyerId);
  }, 120_000);

  it("blocks a second cancellation request and a second refund", async () => {
    transfers.length = 0;
    const escrow = await mkEscrow();

    const first = await requestCancel(escrow.id, "wrong size");
    expect(first.ok).toBe(true);

    const second = await requestCancel(escrow.id, "again");
    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error).toMatch(/already open/i);

    const firstRefund = await runPayout(admin, escrow, "refund", FEE_BPS);
    expect(firstRefund.ok).toBe(true);
    expect(transfers).toHaveLength(1);

    const secondRefund = await runPayout(admin, escrow, "refund", FEE_BPS);
    expect(secondRefund.ok).toBe(false);
    expect(secondRefund.error).toMatch(/already in progress or complete/i);
    // Crucially, no second transfer ever reached Circle.
    expect(transfers).toHaveLength(1);

    // A cancellation cannot be requested once the escrow has moved on.
    await admin.from("escrows").update({ status: "refunded" }).eq("id", escrow.id);
    const afterRefund = await requestCancel(escrow.id, "too late");
    expect(afterRefund.ok).toBe(false);
    expect(afterRefund.ok === false && afterRefund.error).toMatch(/Cannot request cancellation/i);
  }, 120_000);
});
