// Seller-initiated refund (or admin path in future). Flips escrow to `refunded`.
// Actual on-chain payout back to buyer is handled by the payout job (Session 4).

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { notify } from "../_shared/notify.ts";

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
    const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowId).maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);
    if (esc.seller_id !== userId) return json({ error: "Only the seller can refund" }, 403);
    if (!["funded", "disputed"].includes(esc.status))
      return json({ error: `Cannot refund from status ${esc.status}` }, 400);

    const { data: updated, error } = await admin
      .from("escrows")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", escrowId)
      .select("*")
      .single();
    if (error) throw error;

    await notify({
      userId: esc.buyer_id,
      kind: "escrow_refunded",
      title: "Escrow refunded",
      body: `The seller refunded ${Number(esc.amount_usdc).toLocaleString()} USDC back to you.`,
      link: `/escrow/${escrowId}`,
    });

    return json({ escrow: updated });
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
