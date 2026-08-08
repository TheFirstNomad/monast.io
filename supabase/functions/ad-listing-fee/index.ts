// Listing fee verifier: an ad only goes live once its 0.15 USDC anti-spam fee has
// been confirmed on-chain as a transfer to the revenue treasury wallet.
//
// POST { ad_id, tx_hash, chain_id? }

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { verifyUsdcTransfer } from "../_shared/tx-verify.ts";
import { getTreasury, isTreasuryMissing } from "../_shared/treasury.ts";
import { loadFeeSettings } from "../_shared/fees.ts";
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
const DEFAULT_CHAIN = 5042002;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await asUser.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const adId = String(body.ad_id ?? "");
    const txHash = String(body.tx_hash ?? "").trim();
    const chainId = Number(body.chain_id ?? DEFAULT_CHAIN);
    if (!adId || !txHash) return json({ error: "ad_id and tx_hash required" }, 400);
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return json({ error: "tx_hash is not a valid hash" }, 400);
    if (!Number.isInteger(chainId) || chainId <= 0) return json({ error: "chain_id invalid" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Abuse ceiling: these endpoints make live RPC/Circle calls, so an
    // unbounded client retry loop is both costly and a probing vector.
    const rl = await checkUserRateLimit(admin, userId, "ad-listing-fee");
    if (!rl.ok) return json(rateLimitBody(rl), 429);
    const { data: ad } = await admin
      .from("ads")
      .select("id, seller_id, status, listing_fee_paid_at")
      .eq("id", adId)
      .maybeSingle();
    if (!ad) return json({ error: "Ad not found" }, 404);
    if (ad.seller_id !== userId) return json({ error: "Not your ad" }, 403);
    if (ad.listing_fee_paid_at) return json({ ad, already_paid: true });

    const fees = await loadFeeSettings(admin);

    let revenue;
    try {
      revenue = await getTreasury(admin, "revenue", chainId);
    } catch (e) {
      if (isTreasuryMissing(e)) return json({ error: (e as Error).message, configured: false }, 503);
      throw e;
    }

    const verify = await verifyUsdcTransfer({
      chainId,
      txHash,
      expectedTo: revenue.address,
      expectedAmountUsdc: fees.listingFeeUsdc,
    });
    if (!verify.ok) return json({ error: `On-chain verify failed: ${verify.error}` }, 400);

    const { data: updated, error } = await admin
      .from("ads")
      .update({
        listing_fee_usdc: fees.listingFeeUsdc,
        listing_fee_tx_hash: txHash,
        listing_fee_paid_at: new Date().toISOString(),
        listing_fee_chain_id: chainId,
        status: ad.status === "draft" || ad.status === "pending_fee" ? "active" : ad.status,
      })
      .eq("id", adId)
      .select("*")
      .single();
    if (error) {
      // Unique index on lower(listing_fee_tx_hash): the hash was already used.
      if ((error as any).code === "23505") {
        return json({ error: "That transaction has already been used for another listing" }, 400);
      }
      throw error;
    }

    await writeLedger(admin, {
      kind: "listing_fee",
      adId,
      fromUserId: userId,
      chainId,
      amountUsdc: fees.listingFeeUsdc,
      txHash,
      status: "confirmed",
      idempotencyKey: `listing_fee:${adId}`,
      notes: "anti-spam listing fee",
    });

    return json({ ad: updated, amount_usdc: fees.listingFeeUsdc });
  } catch (e) {
    console.error("ad-listing-fee", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
