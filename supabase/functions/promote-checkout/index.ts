// Promote-checkout: activates a paid featured-listing promotion for an ad.
// Validates JWT in code, confirms ad ownership, verifies the treasury payment
// on-chain, records the promotion, and flips ads.featured/featured_until via
// service role (bypassing the prevent_seller_featured_change trigger, which
// only blocks authenticated users).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUsdcTransfer } from "../_shared/tx-verify.ts";
import { getTreasury, isTreasuryMissing } from "../_shared/treasury.ts";
import { writeLedger } from "../_shared/ledger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Tier = "24h" | "7d" | "30d";

// Pricing in USDC. Mirrored client-side in src/lib/promotionTiers.ts.
const TIERS: Record<Tier, { price: number; hours: number; label: string }> = {
  "24h": { price: 5, hours: 24, label: "24 hours" },
  "7d":  { price: 25, hours: 24 * 7, label: "7 days" },
  "30d": { price: 80, hours: 24 * 30, label: "30 days" },
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

  // Authn — verify caller via JWT.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userRes.user.id;

  // Input validation.
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const adId = String(body?.ad_id || "");
  const tier = String(body?.tier || "") as Tier;
  const txHash = body?.tx_hash ? String(body.tx_hash) : null;
  const chainId = body?.chain_id ? Number(body.chain_id) : null;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adId)) {
    return json({ error: "Invalid ad_id" }, 400);
  }
  if (!TIERS[tier]) return json({ error: "Invalid tier" }, 400);
  if (txHash && !/^0x[0-9a-f]{64}$/i.test(txHash)) {
    return json({ error: "Invalid tx_hash" }, 400);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });

  // Ownership check.
  const { data: ad, error: adErr } = await admin
    .from("ads").select("id, seller_id, featured_until")
    .eq("id", adId).maybeSingle();
  if (adErr) return json({ error: adErr.message }, 500);
  if (!ad) return json({ error: "Ad not found" }, 404);
  if (ad.seller_id !== userId) return json({ error: "You do not own this ad" }, 403);

  const conf = TIERS[tier];
  const startsAt = new Date();
  // Extend from existing end if still active.
  const existingEnd = ad.featured_until ? new Date(ad.featured_until) : null;
  const baseEnd = existingEnd && existingEnd > startsAt ? existingEnd : startsAt;
  const endsAt = new Date(baseEnd.getTime() + conf.hours * 3600 * 1000);

  // On-chain payment verification — must be a USDC transfer to the treasury
  // for at least this tier's price on the specified chain.
  if (!txHash || !chainId) return json({ error: "tx_hash and chain_id are required" }, 400);

  let revenue;
  try {
    revenue = await getTreasury(admin, "revenue", chainId);
  } catch (e) {
    if (isTreasuryMissing(e)) return json({ error: (e as Error).message, configured: false }, 503);
    return json({ error: (e as Error).message }, 500);
  }

  const check = await verifyUsdcTransfer({
    chainId, txHash,
    expectedTo: revenue.address,
    expectedAmountUsdc: conf.price,
  });
  if (!check.ok) return json({ error: `payment verification failed: ${check.error}` }, 400);

  // Record the promotion (unique tx_hash prevents reuse).
  const { data: promo, error: insErr } = await admin.from("promotions").insert({
    ad_id: adId,
    owner_user_id: userId,
    tier,
    price_usdc: conf.price,
    tx_hash: txHash,
    chain_id: chainId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "active",
  }).select("id, ends_at").single();
  if (insErr) {
    if (insErr.code === "23505") return json({ error: "This transaction was already used" }, 409);
    return json({ error: insErr.message }, 500);
  }

  // Flip the ad to featured. Service role bypasses the auth-uid trigger guard.
  const { error: updErr } = await admin.from("ads").update({
    featured: true,
    featured_until: endsAt.toISOString(),
  }).eq("id", adId);
  if (updErr) return json({ error: updErr.message }, 500);

  await writeLedger(admin, {
    kind: "promotion_fee",
    adId,
    fromUserId: userId,
    chainId,
    amountUsdc: conf.price,
    txHash,
    status: "confirmed",
    idempotencyKey: `promotion_fee:${promo.id}`,
    notes: `featured listing ${tier}`,
  });

  return json({ ok: true, promotion: promo, ends_at: endsAt.toISOString() });
});
