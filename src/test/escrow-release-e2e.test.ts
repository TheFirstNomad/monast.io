/**
 * End-to-end escrow release test.
 *
 * Continues where the funding test stops: a funded escrow is released and the
 * money must leave the treasury toward the *counterparty's* real payout wallet.
 *
 * What is real here: the ad, escrow, user_wallets/profiles rows, the treasury
 * lookup, the fee split, the ledger entries and every status transition.
 * The only stubbed piece is Circle's transfer API, so no live USDC moves; the
 * arguments handed to it are asserted instead, which is exactly where a wrong
 * destination address would show up.
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
const AMOUNT = 100;
const FEE_BPS = 100; // 1%
const SELLER_PROFILE_WALLET = "0x3333333333333333333333333333333333333333";
const SELLER_LINKED_WALLET = "0x4444444444444444444444444444444444444444";
const BUYER_WALLET = "0x5555555555555555555555555555555555555555";
const DEPOSIT_HASH =
  "0xabc0000000000000000000000000000000000000000000000000000000000001";

const suite = SERVICE ? describe : describe.skip;

suite("escrow release end to end", () => {
  const admin: SupabaseClient = createClient(URL, SERVICE ?? "", {
    auth: { persistSession: false },
  });

  const users: string[] = [];
  const escrowIds: string[] = [];
  let sellerId = "";
  let buyerId = "";
  let adId = "";
  let revenueAddress = "";
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

  const mkEscrow = async (status: "funded") => {
    const { data, error } = await admin
      .from("escrows")
      .insert({
        ad_id: adId,
        buyer_id: buyerId,
        seller_id: sellerId,
        chain_id: ARC_CHAIN_ID,
        amount_usdc: AMOUNT,
        status,
        funded_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    escrowIds.push(data!.id);
    return data!;
  };

  beforeAll(async () => {
    sellerId = await mkUser("rel-seller");
    buyerId = await mkUser("rel-buyer");

    await admin
      .from("profiles")
      .update({ wallet_address: SELLER_PROFILE_WALLET })
      .eq("id", sellerId);
    await admin.from("profiles").update({ wallet_address: BUYER_WALLET }).eq("id", buyerId);

    const { data: ad, error: adErr } = await admin
      .from("ads")
      .insert({
        seller_id: sellerId,
        title: "E2E Release Item",
        description: "Release path test",
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

    const { data: revenue } = await admin
      .from("treasury_wallets")
      .select("address")
      .eq("purpose", "revenue")
      .eq("chain_id", ARC_CHAIN_ID)
      .eq("is_active", true)
      .single();
    revenueAddress = revenue!.address as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of escrowIds) {
      await admin.from("ledger_entries").delete().eq("escrow_id", id);
      await admin.from("notifications").delete().eq("user_id", sellerId);
      await admin.from("escrows").delete().eq("id", id);
    }
    if (adId) {
      await admin.from("payments").delete().eq("ad_id", adId);
      await admin.from("ads").delete().eq("id", adId);
    }
    for (const id of users) await admin.auth.admin.deleteUser(id);
  }, 60_000);

  it("releases the seller's net to the seller's own payout wallet and sweeps the fee", async () => {
    transfers.length = 0;
    const escrow = await mkEscrow("funded");

    const payout = await runPayout(admin, escrow, "release", FEE_BPS);
    expect(payout.error).toBeUndefined();
    expect(payout.ok).toBe(true);
    expect(payout.sellerNet).toBe(99);
    expect(payout.fee).toBe(1);

    // Leg 1: the counterparty (seller) is paid at their own address, out of the
    // escrow treasury wallet, with an exact decimal amount.
    const [sellerLeg, feeLeg] = transfers;
    expect(sellerLeg.destinationAddress).toBe(SELLER_PROFILE_WALLET);
    expect(sellerLeg.destinationAddress).not.toBe(BUYER_WALLET);
    expect(sellerLeg.walletId).toBe(escrowWalletId);
    expect(sellerLeg.amountUsdc).toBe("99");
    expect(sellerLeg.chainId).toBe(ARC_CHAIN_ID);
    expect(sellerLeg.idempotencyKey).toBe(`escrow:${escrow.id}:release`);

    // Leg 2: the 1% platform fee goes to the revenue wallet, never to a user.
    expect(feeLeg.destinationAddress).toBe(revenueAddress);
    expect(feeLeg.amountUsdc).toBe("1");
    expect(feeLeg.idempotencyKey).toBe(`escrow:${escrow.id}:fee`);
    expect(transfers).toHaveLength(2);

    // The escrow now carries the payout, and the release transition + ad state
    // follow exactly as escrow-release performs them.
    const { data: paid } = await admin
      .from("escrows")
      .select("payout_status, payout_circle_tx_id, seller_net_usdc, platform_fee_usdc")
      .eq("id", escrow.id)
      .single();
    expect(paid!.payout_status).toBe("sent");
    expect(paid!.payout_circle_tx_id).toBe(payout.circleTransactionId);
    expect(Number(paid!.seller_net_usdc)).toBe(99);
    expect(Number(paid!.platform_fee_usdc)).toBe(1);

    const { data: released, error: relErr } = await admin
      .from("escrows")
      .update({ status: "released", released_at: new Date().toISOString(), deposit_tx_hash: DEPOSIT_HASH })
      .eq("id", escrow.id)
      .select("status, released_at")
      .single();
    if (relErr) throw relErr;
    expect(released!.status).toBe("released");
    expect(released!.released_at).toBeTruthy();

    await admin
      .from("ads")
      .update({ status: "sold", sold_at: new Date().toISOString() })
      .eq("id", adId);
    const { data: ad } = await admin.from("ads").select("status").eq("id", adId).single();
    expect(ad!.status).toBe("sold");

    // Money trail: seller payout and platform fee are both on the ledger.
    const { data: ledger } = await admin
      .from("ledger_entries")
      .select("kind, amount_usdc, to_user_id, notes")
      .eq("escrow_id", escrow.id);
    const sellerEntry = ledger!.find((l) => l.kind === "seller_payout");
    const feeEntry = ledger!.find((l) => l.kind === "platform_fee");
    expect(Number(sellerEntry!.amount_usdc)).toBe(99);
    expect(sellerEntry!.to_user_id).toBe(sellerId);
    expect(sellerEntry!.notes).toContain(SELLER_PROFILE_WALLET);
    expect(Number(feeEntry!.amount_usdc)).toBe(1);
  }, 120_000);

  it("prefers the seller's wallet linked for this chain over their profile wallet", async () => {
    transfers.length = 0;
    await admin.from("user_wallets").insert({
      user_id: sellerId,
      address: SELLER_LINKED_WALLET,
      kind: "external",
      chain_id: ARC_CHAIN_ID,
      is_primary: true,
    });
    const escrow = await mkEscrow("funded");

    const payout = await runPayout(admin, escrow, "release", FEE_BPS);
    expect(payout.ok).toBe(true);
    expect(transfers[0].destinationAddress).toBe(SELLER_LINKED_WALLET);

    await admin.from("user_wallets").delete().eq("user_id", sellerId);
  }, 120_000);

  it("refuses a second release for the same escrow", async () => {
    const escrow = await mkEscrow("funded");
    const first = await runPayout(admin, escrow, "release", FEE_BPS);
    expect(first.ok).toBe(true);

    const second = await runPayout(admin, escrow, "release", FEE_BPS);
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/already in progress or complete/i);
  }, 120_000);
});
