// Buyer asks to cancel a funded escrow, or the seller responds.
//
// POST { escrow_id, action: "request" | "approve" | "decline" | "mark_delivered", reason? }
//
// Rules
//  - Buyer may request a cancellation on a funded escrow.
//  - Seller may approve (triggering a full refund via escrow-refund), decline, or
//    mark the item delivered, which converts an unresolved cancellation into a
//    dispute rather than letting either side act unilaterally.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { notify } from "../_shared/notify.ts";
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

const ACTIONS = ["request", "approve", "decline", "mark_delivered"] as const;

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
    const action = String(body.action ?? "");
    const reason = body.reason ? String(body.reason).slice(0, 500) : null;
    if (!escrowId) return json({ error: "escrow_id required" }, 400);
    if (!ACTIONS.includes(action as typeof ACTIONS[number])) {
      return json({ error: `action must be one of ${ACTIONS.join(", ")}` }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Abuse ceiling: these endpoints make live RPC/Circle calls, so an
    // unbounded client retry loop is both costly and a probing vector.
    const rl = await checkUserRateLimit(admin, userId, "escrow-cancel");
    if (!rl.ok) return json(rateLimitBody(rl), 429);
    const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowId).maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);

    const isBuyer = esc.buyer_id === userId;
    const isSeller = esc.seller_id === userId;
    if (!isBuyer && !isSeller) return json({ error: "Not your escrow" }, 403);

    const fees = await loadFeeSettings(admin);
    const now = new Date().toISOString();

    if (action === "request") {
      if (!isBuyer) return json({ error: "Only the buyer can request a cancellation" }, 403);
      if (esc.status === "created") {
        // Nothing deposited yet — cancel outright, no cost, no payout needed.
        const { data: cancelled, error } = await admin
          .from("escrows")
          .update({ status: "cancelled", cancel_requested_by: userId, cancel_requested_at: now, cancel_reason: reason })
          .eq("id", escrowId)
          .select("*")
          .single();
        if (error) throw error;
        return json({ escrow: cancelled, outcome: "cancelled_before_funding" });
      }
      if (esc.status !== "funded") {
        return json({ error: `Cannot request cancellation from status ${esc.status}` }, 400);
      }
      if (esc.cancel_requested_at) {
        return json({ error: "A cancellation request is already open" }, 400);
      }

      const { data: updated, error } = await admin
        .from("escrows")
        .update({ cancel_requested_by: userId, cancel_requested_at: now, cancel_reason: reason })
        .eq("id", escrowId)
        .select("*")
        .single();
      if (error) throw error;

      const deadline = new Date(Date.now() + fees.cancelResponseHours * 3600_000).toISOString();
      await notify({
        userId: esc.seller_id,
        kind: "escrow_cancel_requested",
        title: "Buyer asked to cancel",
        body: `You have ${fees.cancelResponseHours}h to approve, decline, or mark the item delivered. ` +
          `After that the buyer can take a full refund.`,
        link: `/escrow/${escrowId}`,
      });
      return json({ escrow: updated, refund_unlocks_at: deadline });
    }

    if (!isSeller) return json({ error: "Only the seller can respond to a cancellation" }, 403);

    if (action === "mark_delivered") {
      if (esc.status !== "funded") {
        return json({ error: `Cannot mark delivered from status ${esc.status}` }, 400);
      }
      const autoRelease = new Date(Date.now() + fees.deliveryWindowHours * 3600_000).toISOString();
      const { data: updated, error } = await admin
        .from("escrows")
        .update({ delivery_marked_at: now, auto_release_at: autoRelease })
        .eq("id", escrowId)
        .select("*")
        .single();
      if (error) throw error;
      await notify({
        userId: esc.buyer_id,
        kind: "escrow_delivered",
        title: "Seller marked your order delivered",
        body: `Confirm within ${fees.deliveryWindowHours}h, or the funds release automatically. ` +
          `Not received? Open a dispute.`,
        link: `/escrow/${escrowId}`,
      });
      return json({ escrow: updated, auto_release_at: autoRelease });
    }

    if (!esc.cancel_requested_at) return json({ error: "No cancellation request to answer" }, 400);

    if (action === "decline") {
      const { data: updated, error } = await admin
        .from("escrows")
        .update({ cancel_reason: reason ? `declined: ${reason}` : "declined by seller" })
        .eq("id", escrowId)
        .select("*")
        .single();
      if (error) throw error;
      await notify({
        userId: esc.buyer_id,
        kind: "escrow_cancel_declined",
        title: "Seller declined the cancellation",
        body: "If you cannot agree, open a dispute and it will be reviewed.",
        link: `/escrow/${escrowId}`,
      });
      return json({ escrow: updated, outcome: "declined" });
    }

    // approve -> the refund itself runs through escrow-refund so there is exactly
    // one payout code path.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/escrow-refund`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ escrow_id: escrowId }),
    });
    const refundBody = await res.json().catch(() => ({}));
    return json(refundBody, res.status);
  } catch (e) {
    console.error("escrow-cancel", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
