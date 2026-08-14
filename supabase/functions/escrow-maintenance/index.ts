// Scheduled escrow maintenance. Invoked every 15 minutes by pg_cron with a
// token stored in internal_config - never callable from the browser.
//
// Two jobs:
//  1. Auto-release: a funded escrow whose delivery-confirmation window has
//     expired pays out to the seller, so a silent buyer cannot freeze funds.
//  2. Cancellation timeout: when the seller ignores a buyer's cancellation past
//     the response window and never marked delivery, the buyer gets a full
//     refund with no platform fee.
//
// Escrows in dispute, or where the seller declined the cancellation, are never
// touched here - those need a human arbitrator.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { notify } from "../_shared/notify.ts";
import { runPayout } from "../_shared/payout.ts";
import { loadFeeSettings } from "../_shared/fees.ts";
import { reconcilePayouts } from "../_shared/reconcile.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const token = req.headers.get("x-cron-token") ?? "";
    const { data: cfg } = await admin
      .from("internal_config")
      .select("value")
      .eq("key", "cron_token")
      .maybeSingle();
    if (!cfg?.value || !(await timingSafeEqual(token, cfg.value))) {
      return json({ error: "Forbidden" }, 403);
    }

    const fees = await loadFeeSettings(admin);
    const nowIso = new Date().toISOString();
    const released: string[] = [];
    const refunded: string[] = [];
    const failures: { id: string; error: string }[] = [];

    // ---- 1. Auto-release after the delivery window -------------------------
    const { data: dueRelease } = await admin
      .from("escrows")
      .select("*")
      .eq("status", "funded")
      .in("payout_status", ["none", "failed"])
      .is("cancel_requested_at", null)
      .not("auto_release_at", "is", null)
      .lte("auto_release_at", nowIso)
      .limit(BATCH);

    for (const esc of dueRelease ?? []) {
      const payout = await runPayout(admin, esc, "release", fees.saleFeeBps);
      if (!payout.ok) {
        failures.push({ id: esc.id, error: payout.error ?? "payout failed" });
        continue;
      }
      await admin
        .from("escrows")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("id", esc.id);

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

      await notify([
        {
          userId: esc.seller_id,
          kind: "escrow_auto_released",
          title: "Escrow released automatically",
          body: `The confirmation window expired. ${payout.sellerNet} USDC is on its way to your wallet` +
            (payout.fee ? ` (after a ${payout.fee} USDC platform fee).` : "."),
          link: `/escrow/${esc.id}`,
        },
        {
          userId: esc.buyer_id,
          kind: "escrow_auto_released",
          title: "Your escrow released automatically",
          body: "The confirmation window expired, so the funds went to the seller.",
          link: `/escrow/${esc.id}`,
        },
      ]);
      released.push(esc.id);
    }

    // ---- 2. Refund when the seller ignored a cancellation ------------------
    const cancelCutoff = new Date(Date.now() - fees.cancelResponseHours * 3600_000).toISOString();
    const { data: dueRefund } = await admin
      .from("escrows")
      .select("*")
      .eq("status", "funded")
      .in("payout_status", ["none", "failed"])
      .is("delivery_marked_at", null)
      .not("cancel_requested_at", "is", null)
      .lte("cancel_requested_at", cancelCutoff)
      .limit(BATCH);

    for (const esc of dueRefund ?? []) {
      if (typeof esc.cancel_reason === "string" && esc.cancel_reason.startsWith("declined")) continue;

      const payout = await runPayout(admin, esc, "refund", fees.saleFeeBps);
      if (!payout.ok) {
        failures.push({ id: esc.id, error: payout.error ?? "refund failed" });
        continue;
      }
      await admin
        .from("escrows")
        .update({ status: "refunded", refunded_at: new Date().toISOString() })
        .eq("id", esc.id);
      await admin.from("ads").update({ status: "active" }).eq("id", esc.ad_id);

      await notify([
        {
          userId: esc.buyer_id,
          kind: "escrow_auto_refunded",
          title: "Full refund on its way",
          body: `The seller did not answer your cancellation within ${fees.cancelResponseHours}h, so ${esc.amount_usdc} USDC is being returned in full.`,
          link: `/escrow/${esc.id}`,
        },
        {
          userId: esc.seller_id,
          kind: "escrow_auto_refunded",
          title: "Escrow refunded to the buyer",
          body: `The cancellation request went unanswered for ${fees.cancelResponseHours}h.`,
          link: `/escrow/${esc.id}`,
        },
      ]);
      refunded.push(esc.id);
    }

    // ---- 3. Reconcile in-flight payouts against Circle ---------------------
    // "Circle accepted the transfer" is not "the money landed"; this pass turns
    // sent -> confirmed/failed and raises an alert on failures.
    let reconcile: unknown = null;
    try {
      reconcile = await reconcilePayouts(admin);
    } catch (e) {
      console.error("reconcile pass failed", (e as Error).message);
    }

    if (failures.length) console.error("escrow-maintenance failures", failures);
    return json({ released, refunded, failures, reconcile, ran_at: nowIso });
  } catch (e) {
    console.error("escrow-maintenance", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
