// Verifies a USDC payment on-chain, records it, and marks the ad sold.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUsdcTransfer } from "../_shared/tx-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const buyerId = userRes.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const adId = String(body?.ad_id || "");
  const txHash = String(body?.tx_hash || "");
  const chainId = Number(body?.chain_id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adId)) return json({ error: "Invalid ad_id" }, 400);
  if (!/^0x[0-9a-f]{64}$/i.test(txHash)) return json({ error: "Invalid tx_hash" }, 400);
  if (!Number.isFinite(chainId)) return json({ error: "Invalid chain_id" }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });

  // Load ad + seller wallet.
  const { data: ad, error: adErr } = await admin
    .from("ads").select("id, seller_id, price_usdc, status").eq("id", adId).maybeSingle();
  if (adErr) return json({ error: adErr.message }, 500);
  if (!ad) return json({ error: "Ad not found" }, 404);

  // Determine expected amount: accepted offer for buyer OR ad price.
  let expectedAmount = Number(ad.price_usdc);
  const { data: acceptedOffer } = await admin.from("offers")
    .select("amount_usdc").eq("ad_id", adId).eq("buyer_id", buyerId).eq("status", "accepted")
    .maybeSingle();
  if (acceptedOffer) expectedAmount = Number(acceptedOffer.amount_usdc);

  const { data: sellerProfile } = await admin.from("profiles")
    .select("wallet_address").eq("id", ad.seller_id).maybeSingle();
  const sellerWallet = sellerProfile?.wallet_address as string | null | undefined;
  if (!sellerWallet) return json({ error: "Seller has no wallet on file" }, 400);

  const { data: buyerProfile } = await admin.from("profiles")
    .select("wallet_address").eq("id", buyerId).maybeSingle();

  // On-chain verification.
  const check = await verifyUsdcTransfer({
    chainId, txHash,
    expectedTo: sellerWallet,
    expectedAmountUsdc: expectedAmount,
    expectedFrom: buyerProfile?.wallet_address ?? undefined,
  });
  if (!check.ok) return json({ error: `payment verification failed: ${check.error}` }, 400);

  const { data: inserted, error: insErr } = await admin.from("payments").insert({
    ad_id: adId,
    buyer_id: buyerId,
    seller_id: ad.seller_id,
    amount_usdc: expectedAmount,
    tx_hash: txHash,
    chain_id: chainId,
  }).select("*").single();
  if (insErr) {
    if (insErr.code === "23505") return json({ error: "This transaction was already recorded" }, 409);
    return json({ error: insErr.message }, 500);
  }

  await admin.from("ads").update({ status: "sold", sold_at: new Date().toISOString() }).eq("id", adId);

  return json({ ok: true, payment: inserted });
});
