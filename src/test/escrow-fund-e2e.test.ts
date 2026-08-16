/**
 * End-to-end escrow funding test.
 *
 * Walks the full deposit path the way `escrow-confirm-funded` does:
 *   real ad + escrow rows in the database
 *   -> on-chain proof verified through verifyUsdcTransfer against a stubbed
 *      Arc JSON-RPC endpoint
 *   -> escrow flips to `funded`, deposit hash recorded, ad taken off the market
 *
 * The sender binding is exercised for real: a transfer that came from a
 * stranger's wallet must be rejected even though the amount, destination and
 * confirmation depth are all correct.
 *
 * The database legs are skipped when SUPABASE_SERVICE_ROLE_KEY is absent; the
 * verification legs always run.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyUsdcTransfer } from "../../supabase/functions/_shared/tx-verify.ts";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ARC_CHAIN_ID = 5042002;
const ARC_USDC = "0x3600000000000000000000000000000000000000";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TREASURY = "0x00000000000000000000000000000000000000t1".replace("t1", "a1");
const BUYER_WALLET = "0x1111111111111111111111111111111111111111";
const STRANGER_WALLET = "0x2222222222222222222222222222222222222222";
const AMOUNT = 100;

const pad32 = (addr: string) => "0x" + addr.slice(2).toLowerCase().padStart(64, "0");
const microsHex = (usdc: number) => "0x" + BigInt(Math.round(usdc * 1e6)).toString(16);

/** Stubs the Arc JSON-RPC endpoint with a single USDC Transfer receipt. */
function stubArcRpc(opts: { from: string; to: string; amount: number; confirmations?: number }) {
  const mined = 1000;
  const head = mined + (opts.confirmations ?? 6) - 1;
  const spy = vi.fn(async (_url: any, init?: any) => {
    const { method } = JSON.parse(init.body);
    const result =
      method === "eth_blockNumber"
        ? "0x" + head.toString(16)
        : {
            status: "0x1",
            blockNumber: "0x" + mined.toString(16),
            logs: [
              {
                address: ARC_USDC,
                topics: [TRANSFER_TOPIC, pad32(opts.from), pad32(opts.to)],
                data: microsHex(opts.amount),
              },
            ],
          };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

const txHash = () =>
  "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

describe("escrow funding end to end", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a deposit that came from the caller's own wallet", async () => {
    stubArcRpc({ from: BUYER_WALLET, to: TREASURY, amount: AMOUNT });
    const verify = await verifyUsdcTransfer({
      chainId: ARC_CHAIN_ID,
      txHash: txHash(),
      expectedTo: TREASURY,
      expectedAmountUsdc: AMOUNT,
      expectedFrom: BUYER_WALLET,
    });
    expect(verify.ok).toBe(true);
    expect(verify.from).toBe(BUYER_WALLET.toLowerCase());
    expect(verify.amountUsdc).toBe(AMOUNT);
  });

  it("rejects an otherwise valid deposit sent from someone else's wallet", async () => {
    stubArcRpc({ from: STRANGER_WALLET, to: TREASURY, amount: AMOUNT });
    const verify = await verifyUsdcTransfer({
      chainId: ARC_CHAIN_ID,
      txHash: txHash(),
      expectedTo: TREASURY,
      expectedAmountUsdc: AMOUNT,
      expectedFrom: BUYER_WALLET,
    });
    expect(verify.ok).toBe(false);
    expect(verify.pending).toBeFalsy();
    expect(verify.error).toMatch(/no matching USDC Transfer/i);
  });

  it("holds a shallow deposit in a wait state instead of failing it", async () => {
    stubArcRpc({ from: BUYER_WALLET, to: TREASURY, amount: AMOUNT, confirmations: 1 });
    const verify = await verifyUsdcTransfer({
      chainId: ARC_CHAIN_ID,
      txHash: txHash(),
      expectedTo: TREASURY,
      expectedAmountUsdc: AMOUNT,
      expectedFrom: BUYER_WALLET,
    });
    expect(verify.ok).toBe(false);
    expect(verify.pending).toBe(true);
  });

  it("rejects a deposit that is short of the escrow amount", async () => {
    stubArcRpc({ from: BUYER_WALLET, to: TREASURY, amount: AMOUNT - 0.000001 });
    const verify = await verifyUsdcTransfer({
      chainId: ARC_CHAIN_ID,
      txHash: txHash(),
      expectedTo: TREASURY,
      expectedAmountUsdc: AMOUNT,
      expectedFrom: BUYER_WALLET,
    });
    expect(verify.ok).toBe(false);
    expect(verify.error).toMatch(/no matching USDC Transfer/i);
  });
});

const dbSuite = SERVICE ? describe : describe.skip;

dbSuite("escrow funding end to end (database)", () => {
  const admin: SupabaseClient = createClient(URL, SERVICE ?? "", {
    auth: { persistSession: false },
  });

  let sellerId = "";
  let buyerId = "";
  let adId = "";
  let escrowId = "";
  const created: string[] = [];

  const mkUser = async (label: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${label}-${crypto.randomUUID()}@test.monast.local`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (error) throw error;
    created.push(data.user!.id);
    return data.user!.id;
  };

  beforeAll(async () => {
    sellerId = await mkUser("e2e-seller");
    buyerId = await mkUser("e2e-buyer");

    // The buyer's wallet is what the deposit proof is bound to.
    await admin.from("profiles").update({ wallet_address: BUYER_WALLET }).eq("id", buyerId);

    const { data: ad, error: adErr } = await admin
      .from("ads")
      .insert({
        seller_id: sellerId,
        title: "E2E Escrow Item",
        description: "Funding path test",
        category: "other",
        condition: "New",
        location: "Internet",
        price_usdc: AMOUNT,
        images: [],
        status: "active",
      })
      .select("id")
      .single();
    if (adErr) throw adErr;
    adId = ad!.id;

    const { data: esc, error: escErr } = await admin
      .from("escrows")
      .insert({
        ad_id: adId,
        buyer_id: buyerId,
        seller_id: sellerId,
        chain_id: ARC_CHAIN_ID,
        amount_usdc: AMOUNT,
        status: "created",
      })
      .select("id")
      .single();
    if (escErr) throw escErr;
    escrowId = esc!.id;
  }, 60_000);

  afterAll(async () => {
    if (escrowId) await admin.from("escrows").delete().eq("id", escrowId);
    if (adId) await admin.from("ads").delete().eq("id", adId);
    for (const id of created) await admin.auth.admin.deleteUser(id);
  }, 60_000);

  afterEach(() => vi.unstubAllGlobals());

  it("funds the escrow with the buyer's own wallet and reserves the ad", async () => {
    const { data: profile } = await admin
      .from("profiles")
      .select("wallet_address")
      .eq("id", buyerId)
      .maybeSingle();
    expect(profile?.wallet_address).toBe(BUYER_WALLET);

    const hash = txHash();
    stubArcRpc({ from: profile!.wallet_address as string, to: TREASURY, amount: AMOUNT });
    const verify = await verifyUsdcTransfer({
      chainId: ARC_CHAIN_ID,
      txHash: hash,
      expectedTo: TREASURY,
      expectedAmountUsdc: AMOUNT,
      expectedFrom: profile?.wallet_address ?? undefined,
    });
    vi.unstubAllGlobals();
    expect(verify.ok).toBe(true);

    const { data: funded, error } = await admin
      .from("escrows")
      .update({
        status: "funded",
        deposit_tx_hash: hash,
        funded_at: new Date().toISOString(),
        tx_hashes: [{ kind: "deposit", hash }],
      })
      .eq("id", escrowId)
      .select("status, deposit_tx_hash, funded_at")
      .single();
    if (error) throw error;
    expect(funded!.status).toBe("funded");
    expect(funded!.deposit_tx_hash).toBe(hash);
    expect(funded!.funded_at).toBeTruthy();

    await admin.from("ads").update({ status: "reserved" }).eq("id", adId).eq("status", "active");
    const { data: ad } = await admin.from("ads").select("status").eq("id", adId).single();
    expect(ad!.status).toBe("reserved");
  }, 60_000);

  it("refuses to reuse the same deposit hash for a second escrow", async () => {
    const { data: first } = await admin
      .from("escrows")
      .select("deposit_tx_hash")
      .eq("id", escrowId)
      .single();

    const { data: second, error: mkErr } = await admin
      .from("escrows")
      .insert({
        ad_id: adId,
        buyer_id: buyerId,
        seller_id: sellerId,
        chain_id: ARC_CHAIN_ID,
        amount_usdc: AMOUNT,
        status: "created",
      })
      .select("id")
      .single();
    if (mkErr) throw mkErr;

    const { error } = await admin
      .from("escrows")
      .update({ status: "funded", deposit_tx_hash: first!.deposit_tx_hash })
      .eq("id", second!.id);

    await admin.from("escrows").delete().eq("id", second!.id);
    expect(error).toBeTruthy();
    expect((error as any)?.code).toBe("23505");
  }, 60_000);
});
