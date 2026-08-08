// Buyer confirms delivery. Sends the real USDC payout from the escrow treasury
// to the seller (minus the platform fee, which is swept to the revenue wallet),
// then flips the escrow to `released` and marks the ad sold.
//
// The status only moves after the transfer has been accepted by Circle, so a
// released escrow always has money in flight behind it.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { notify } from "../_shared/notify.ts";
import { runPayout } from "../_shared/payout.ts";
import { loadFeeSettings } from "../_shared/fees.ts";
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
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const escrowId = String(body.escrow_id ?? "");
    if (!escrowId) return json({ error: "escrow_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Abuse ceiling: these endpoints make live RPC/Circle calls, so an
    // unbounded client retry loop is both costly and a probing vector.
    const rl = await checkUserRateLimit(admin, userId, "escrow-release");
    if (!rl.ok) return json(rateLimitBody(rl), 429);
    const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowId).maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);
    if (esc.buyer_id !== userId) return json({ error: "Only the buyer can release" }, 403);
    if (!["funded", "disputed"].includes(esc.status))
      return json({ error: `Cannot release from status ${esc.status}` }, 400);

    const fees = await loadFeeSettings(admin);
    const payout = await runPayout(admin, esc, "release", fees.saleFeeBps);
    if (!payout.ok) return json({ error: payout.error }, 400);

    const { data: updated, error } = await admin
      .from("escrows")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", escrowId)
      .select("*")
      .single();
    if (error) throw error;

    // Record a payments row so reviews unlock. Uses the deposit tx hash.
    if (esc.deposit_tx_hash) {
      await admin.from("payments").insert({
        ad_id: esc.ad_id,
        buyer_id: esc.buyer_id,
        seller_id: esc.seller_id,
        amount_usdc: esc.amount_usdc,
        tx_hash: esc.deposit_tx_hash,
        chain_id: esc.chain_id,
      }).select().maybeSingle();
    }

    await admin
      .from("ads")
      .update({ status: "sold", sold_at: new Date().toISOString() })
      .eq("id", esc.ad_id);

    await notify({
      userId: esc.seller_id,
      kind: "escrow_released",
      title: "Escrow released to you",
      body: `The buyer confirmed delivery. ${payout.sellerNet?.toLocaleString()} USDC is on its way to your wallet` +
        (payout.fee ? ` (after a ${payout.fee} USDC platform fee).` : "."),
      link: `/escrow/${escrowId}`,
    });

    return json({
      escrow: updated,
      payout: {
        circle_transaction_id: payout.circleTransactionId,
        seller_net_usdc: payout.sellerNet,
        platform_fee_usdc: payout.fee,
      },
    });
  } catch (e) {
    console.error("escrow-release", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
