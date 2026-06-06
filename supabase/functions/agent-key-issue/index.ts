// Issue a new API key for a delegated agent owned by the authenticated user.
// Returns the plain key ONCE; only the SHA-256 hash is stored.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, svcClient, generateApiKey, sha256Hex } from "../_shared/agent-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  // Verify the caller's session
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.slice(7));
  if (claimsErr || !claims?.claims) return json({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const displayName = String(body?.display_name ?? "").trim();
  const walletAddress = String(body?.wallet_address ?? "").trim();
  const maxSpend = Number(body?.max_spend_usdc_per_day ?? 100);
  if (!displayName || displayName.length > 80) return json({ error: "display_name required (≤80 chars)" }, 400);
  if (!walletAddress) return json({ error: "wallet_address required" }, 400);
  if (!Number.isFinite(maxSpend) || maxSpend < 0 || maxSpend > 1_000_000) return json({ error: "invalid spend cap" }, 400);

  const { key, prefix } = generateApiKey();
  const hash = await sha256Hex(key);

  const svc = svcClient();
  const { data, error } = await svc.from("agents").insert({
    owner_user_id: userId,
    kind: "delegated",
    display_name: displayName,
    wallet_address: walletAddress,
    api_key_hash: hash,
    api_key_prefix: prefix,
    max_spend_usdc_per_day: maxSpend,
  }).select("id, display_name, wallet_address, api_key_prefix, max_spend_usdc_per_day, status").single();

  if (error) return json({ error: error.message }, 400);
  return json({ ...data, api_key: key, note: "Store this key now — it will not be shown again." });
});
