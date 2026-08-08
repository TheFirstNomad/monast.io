// Either party can flag a funded escrow as `disputed`. Manual admin resolution
// in v1 — a future function will resolve to released or refunded.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { notify } from "../_shared/notify.ts";
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
    const reason = String(body.reason ?? "").slice(0, 500);
    if (!escrowId) return json({ error: "escrow_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Abuse ceiling: these endpoints make live RPC/Circle calls, so an
    // unbounded client retry loop is both costly and a probing vector.
    const rl = await checkUserRateLimit(admin, userId, "escrow-dispute");
    if (!rl.ok) return json(rateLimitBody(rl), 429);
    const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowId).maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);
    if (esc.buyer_id !== userId && esc.seller_id !== userId)
      return json({ error: "Not a participant" }, 403);
    if (esc.status !== "funded") return json({ error: "Only funded escrows can be disputed" }, 400);

    const meta = { ...(esc.metadata ?? {}), dispute: { by: userId, reason, at: new Date().toISOString() } };
    const { data: updated, error } = await admin
      .from("escrows")
      .update({ status: "disputed", metadata: meta })
      .eq("id", escrowId)
      .select("*")
      .single();
    if (error) throw error;
    const counterparty = esc.buyer_id === userId ? esc.seller_id : esc.buyer_id;
    await notify({
      userId: counterparty,
      kind: "escrow_disputed",
      title: "A dispute was opened",
      body: reason || "The other party opened a dispute on this escrow.",
      link: `/escrow/${escrowId}`,
    });

    return json({ escrow: updated });
  } catch (e) {
    console.error("escrow-dispute", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
