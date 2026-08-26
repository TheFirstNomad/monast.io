// Verifies that the buyer's USDC deposit landed at the escrow treasury on-chain,
// then flips the escrow row from `created` to `funded`.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { notify } from "../_shared/notify.ts";
import { verifyUsdcTransfer } from "../_shared/tx-verify.ts";
import { getTreasury, isTreasuryMissing } from "../_shared/treasury.ts";
import { writeLedger } from "../_shared/ledger.ts";
import { checkUserRateLimit, rateLimitBody } from "../_shared/user-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await asUser.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);
    const buyerId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const escrowId = String(body.escrow_id ?? "");
    const txHash = String(body.tx_hash ?? "");
    if (!escrowId || !txHash) return json({ error: "escrow_id and tx_hash required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Abuse ceiling: these endpoints make live RPC/Circle calls, so an
    // unbounded client retry loop is both costly and a probing vector.
    const rl = await checkUserRateLimit(admin, buyerId, "escrow-confirm-funded");
    if (!rl.ok) return json(rateLimitBody(rl), 429);
    const { data: esc } = await admin
      .from("escrows")
      .select("*")
      .eq("id", escrowId)
      .maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);
    if (esc.buyer_id !== buyerId) return json({ error: "Not your escrow" }, 403);
    if (esc.status !== "created") return json({ error: `Escrow already ${esc.status}` }, 400);

    let treasury;
    try {
      treasury = await getTreasury(admin, "escrow", esc.chain_id);
    } catch (e) {
      if (isTreasuryMissing(e)) return json({ error: (e as Error).message, configured: false }, 503);
      throw e;
    }

    // Bind the proof to this buyer's own wallet so a stranger's transaction
    // hash cannot be replayed by someone else.
    const { data: buyerProfile } = await admin
      .from("profiles")
      .select("wallet_address, circle_wallet_address")
      .eq("id", buyerId)
      .maybeSingle();

    const verify = await verifyUsdcTransfer({
      chainId: esc.chain_id,
      txHash,
      expectedTo: treasury.address,
      expectedAmountUsdc: Number(esc.amount_usdc),
      expectedFrom: buyerProfile?.wallet_address ?? buyerProfile?.circle_wallet_address ?? undefined,
    });
    if (!verify.ok) {
      // "Not deep enough yet" is a wait state, not a rejection: 202 lets the
      // client keep polling instead of showing a hard failure.
      if (verify.pending) {
        return json(
          {
            error: "Your deposit is still confirming on Arc. This usually takes a few seconds.",
            status: "confirming",
            confirmations: verify.confirmations ?? 0,
            required_confirmations: verify.requiredConfirmations ?? null,
          },
          202,
        );
      }
      return json({ error: `On-chain verify failed: ${verify.error}` }, 400);
    }

    const nextHashes = Array.isArray(esc.tx_hashes) ? [...esc.tx_hashes, { kind: "deposit", hash: txHash }] : [{ kind: "deposit", hash: txHash }];
    const { data: updated, error } = await admin
      .from("escrows")
      .update({
        status: "funded",
        deposit_tx_hash: txHash,
        funded_at: new Date().toISOString(),
        tx_hashes: nextHashes,
      })
      .eq("id", escrowId)
      .select("*")
      .single();
    if (error) {
      // 23505 = unique violation on lower(deposit_tx_hash): this on-chain
      // transfer has already been consumed by another escrow.
      if ((error as any).code === "23505") {
        console.error(
          "DEPOSIT_HASH_REUSE",
          JSON.stringify({ escrowId, txHash, buyerId }),
        );
        return json(
          { error: "This transaction has already been used to fund a different escrow." },
          409,
        );
      }
      throw error;
    }

    // Append-only record of the deposit leg.
    await writeLedger(admin, {
      kind: "escrow_deposit",
      escrowId,
      adId: esc.ad_id,
      fromUserId: esc.buyer_id,
      chainId: esc.chain_id,
      amountUsdc: Number(esc.amount_usdc),
      txHash,
      status: "confirmed",
      idempotencyKey: `escrow_deposit:${escrowId}`,
    });

    // Take the item off the market while the money is held.
    await admin
      .from("ads")
      .update({ status: "reserved" })
      .eq("id", esc.ad_id)
      .eq("status", "active");


    await notify({
      userId: esc.seller_id,
      kind: "escrow_funded",
      title: "Buyer funded an escrow",
      body: `${Number(esc.amount_usdc).toLocaleString()} USDC is held in escrow. Deliver the item, then the buyer releases the funds.`,
      link: `/escrow/${escrowId}`,
    });

    return json({ escrow: updated });
  } catch (e) {
    console.error("escrow-confirm-funded", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
