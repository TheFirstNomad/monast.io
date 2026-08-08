// Refund path. Returns 100% of the escrowed USDC to the buyer — no platform fee
// is ever charged on a deal that did not complete. Callable by the seller, or by
// the buyer once the seller has failed to answer a cancellation request in time.

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
    const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await asUser.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const escrowId = String(body.escrow_id ?? "");
    if (!escrowId) return json({ error: "escrow_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Abuse ceiling: these endpoints make live RPC/Circle calls, so an
    // unbounded client retry loop is both costly and a probing vector.
    const rl = await checkUserRateLimit(admin, userId, "escrow-refund");
    if (!rl.ok) return json(rateLimitBody(rl), 429);
    const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowId).maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);
    if (!["funded", "disputed"].includes(esc.status))
      return json({ error: `Cannot refund from status ${esc.status}` }, 400);

    const fees = await loadFeeSettings(admin);
    const isSeller = esc.seller_id === userId;
    const isBuyer = esc.buyer_id === userId;
    if (!isSeller && !isBuyer) return json({ error: "Not your escrow" }, 403);

    // The buyer may self-serve a refund only when they asked to cancel and the
    // seller neither answered nor marked the item delivered within the window.
    if (!isSeller) {
      if (!esc.cancel_requested_at) {
        return json(
          { error: "Request a cancellation first — the seller has a chance to respond." },
          400,
        );
      }
      if (esc.delivery_marked_at) {
        return json(
          { error: "The seller marked this as delivered. Open a dispute instead of self-refunding." },
          400,
        );
      }
      const deadline = new Date(esc.cancel_requested_at).getTime() +
        fees.cancelResponseHours * 3600_000;
      if (Date.now() < deadline) {
        return json(
          {
            error: `The seller has until ${new Date(deadline).toISOString()} to respond.`,
            refund_unlocks_at: new Date(deadline).toISOString(),
          },
          400,
        );
      }
    }

    const payout = await runPayout(admin, esc, "refund", fees.saleFeeBps);
    if (!payout.ok) return json({ error: payout.error }, 400);

    const { data: updated, error } = await admin
      .from("escrows")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", escrowId)
      .select("*")
      .single();
    if (error) throw error;

    // The item is available again.
    await admin
      .from("ads")
      .update({ status: "active" })
      .eq("id", esc.ad_id)
      .eq("status", "reserved");

    await notify({
      userId: esc.buyer_id,
      kind: "escrow_refunded",
      title: "Escrow refunded in full",
      body: `${Number(esc.amount_usdc).toLocaleString()} USDC is on its way back to your wallet. No fee was charged.`,
      link: `/escrow/${escrowId}`,
    });
    if (isBuyer) {
      await notify({
        userId: esc.seller_id,
        kind: "escrow_refunded",
        title: "Escrow auto-refunded to the buyer",
        body: "The cancellation window expired without a response, so the funds went back to the buyer.",
        link: `/escrow/${escrowId}`,
      });
    }

    return json({
      escrow: updated,
      payout: { circle_transaction_id: payout.circleTransactionId, amount_usdc: payout.sellerNet },
    });
  } catch (e) {
    console.error("escrow-refund", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
