// Creates a new escrow row for a buyer/ad pair. Idempotent per (ad_id, buyer_id)
// while an escrow is in "created" or "funded" state — a second call returns the
// existing row instead of creating a duplicate.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ARC_CHAIN_ID = 5042002;

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
    const adId = String(body.ad_id ?? "");
    const chainId = Number(body.chain_id ?? ARC_CHAIN_ID);
    if (!adId) return json({ error: "ad_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: ad, error: adErr } = await admin
      .from("ads")
      .select("id, seller_id, price_usdc, status")
      .eq("id", adId)
      .maybeSingle();
    if (adErr || !ad) return json({ error: "Ad not found" }, 404);
    if (ad.seller_id === buyerId) return json({ error: "Cannot buy your own ad" }, 400);
    if (ad.status !== "active") return json({ error: "Ad is not active" }, 400);

    // Amount = accepted offer if any, else ad price.
    const { data: acceptedOffer } = await admin
      .from("offers")
      .select("id, amount_usdc")
      .eq("ad_id", adId)
      .eq("buyer_id", buyerId)
      .eq("status", "accepted")
      .maybeSingle();
    const amount = Number(acceptedOffer?.amount_usdc ?? ad.price_usdc);

    // Reuse an active escrow if present.
    const { data: existing } = await admin
      .from("escrows")
      .select("*")
      .eq("ad_id", adId)
      .eq("buyer_id", buyerId)
      .in("status", ["created", "funded", "disputed"])
      .maybeSingle();
    if (existing) return json({ escrow: existing, reused: true });

    const { data: inserted, error: insErr } = await admin
      .from("escrows")
      .insert({
        ad_id: adId,
        buyer_id: buyerId,
        seller_id: ad.seller_id,
        offer_id: acceptedOffer?.id ?? null,
        chain_id: chainId,
        amount_usdc: amount,
        status: "created",
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    return json({ escrow: inserted, reused: false });
  } catch (e) {
    console.error("escrow-create", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
