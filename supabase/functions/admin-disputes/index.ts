// Arbitrator dispute queue.
//
// POST { action: "list" }
// POST { action: "resolve", escrow_id, outcome: "release" | "refund", notes? }
//
// Only accounts holding the arbitrator or admin role may call this. The payout
// runs through the same runPayout path as buyer-initiated release/refund, so an
// arbitrated outcome cannot bypass the fee split or the one-payout guarantee.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { authorize } from "../_shared/role-auth.ts";
import { notify } from "../_shared/notify.ts";
import { runPayout } from "../_shared/payout.ts";
import { loadFeeSettings } from "../_shared/fees.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const caller = await authorize(req, admin);
    if (!caller.userId) return json({ error: "Unauthorized" }, 401);
    if (!caller.has("arbitrator", "admin")) return json({ error: "Arbitrator role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    if (action === "list") {
      const { data, error } = await admin
        .from("escrows")
        .select("*, ads(id, title, images, category), buyer:profiles!escrows_buyer_id_fkey(id)")
        .eq("status", "disputed")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) {
        // The profile join is optional — fall back to a plain read.
        const { data: plain } = await admin
          .from("escrows")
          .select("*, ads(id, title, images, category)")
          .eq("status", "disputed")
          .order("updated_at", { ascending: false })
          .limit(100);
        return json({ escrows: plain ?? [] });
      }
      return json({ escrows: data ?? [] });
    }

    if (action !== "resolve") return json({ error: "Unknown action" }, 400);

    const escrowId = String(body.escrow_id ?? "");
    const outcome = String(body.outcome ?? "");
    const notes = body.notes ? String(body.notes).slice(0, 1000) : null;
    if (!escrowId) return json({ error: "escrow_id required" }, 400);
    if (!["release", "refund"].includes(outcome)) {
      return json({ error: "outcome must be release or refund" }, 400);
    }

    const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowId).maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);
    if (esc.status !== "disputed") {
      return json({ error: `Only disputed escrows can be arbitrated (status: ${esc.status})` }, 400);
    }

    const fees = await loadFeeSettings(admin);
    const payout = await runPayout(admin, esc, outcome as "release" | "refund", fees.saleFeeBps);
    if (!payout.ok) return json({ error: payout.error }, 400);

    const now = new Date().toISOString();
    const meta = {
      ...(esc.metadata ?? {}),
      arbitration: { by: caller.userId, outcome, notes, at: now },
    };

    const patch = outcome === "release"
      ? { status: "released", released_at: now, metadata: meta }
      : { status: "refunded", refunded_at: now, metadata: meta };

    const { data: updated, error: upErr } = await admin
      .from("escrows")
      .update(patch)
      .eq("id", escrowId)
      .select("*")
      .single();
    if (upErr) throw upErr;

    if (outcome === "release") {
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
      await admin.from("ads").update({ status: "sold", sold_at: now }).eq("id", esc.ad_id);
    } else {
      await admin.from("ads").update({ status: "active" }).eq("id", esc.ad_id);
    }

    const summary = outcome === "release"
      ? `The dispute was resolved in the seller's favour. ${payout.sellerNet} USDC was released.`
      : `The dispute was resolved in the buyer's favour. ${payout.sellerNet} USDC was refunded in full.`;

    await notify([
      { userId: esc.buyer_id, kind: "escrow_arbitrated", title: "Dispute resolved", body: summary, link: `/escrow/${escrowId}` },
      { userId: esc.seller_id, kind: "escrow_arbitrated", title: "Dispute resolved", body: summary, link: `/escrow/${escrowId}` },
    ]);

    return json({
      escrow: updated,
      payout: {
        circle_transaction_id: payout.circleTransactionId,
        amount_usdc: payout.sellerNet,
        platform_fee_usdc: payout.fee,
      },
    });
  } catch (e) {
    console.error("admin-disputes", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
