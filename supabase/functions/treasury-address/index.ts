// Returns the treasury deposit address for a chain so the buyer's wallet knows
// where to send USDC. Fails loudly when the treasury is not provisioned - the
// app must never show a placeholder address.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getTreasury, isTreasuryMissing } from "../_shared/treasury.ts";
import { loadFeeSettings } from "../_shared/fees.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    const url = new URL(req.url);
    const bodyRaw = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const purposeRaw = String(bodyRaw.purpose ?? url.searchParams.get("purpose") ?? "escrow");
    const chainId = Number(bodyRaw.chain_id ?? url.searchParams.get("chain_id") ?? 5042002);
    if (purposeRaw !== "escrow" && purposeRaw !== "revenue") {
      return json({ error: "purpose must be escrow or revenue" }, 400);
    }
    if (!Number.isInteger(chainId) || chainId <= 0) {
      return json({ error: "chain_id must be a positive integer" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const fees = await loadFeeSettings(admin);

    try {
      const wallet = await getTreasury(admin, purposeRaw, chainId);
      return json({
        address: wallet.address,
        chain_id: wallet.chain_id,
        purpose: wallet.purpose,
        fees: {
          listing_fee_usdc: fees.listingFeeUsdc,
          sale_fee_bps: fees.saleFeeBps,
        },
      });
    } catch (e) {
      if (isTreasuryMissing(e)) return json({ error: (e as Error).message, configured: false }, 503);
      throw e;
    }
  } catch (e) {
    console.error("treasury-address", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
