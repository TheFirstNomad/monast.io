// Polls a Circle transaction so the client can learn the on-chain tx hash
// after the user completes the PIN challenge. Read-only.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CIRCLE_BASE = "https://api.circle.com/v1/w3s";
const CIRCLE_API_KEY = Deno.env.get("CIRCLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function circle(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CIRCLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Circle ${path} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

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

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body.transaction_id ?? "");
    if (!transactionId) return json({ error: "transaction_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await admin
      .from("profiles")
      .select("circle_user_id")
      .eq("id", userRes.user.id)
      .maybeSingle();
    if (!profile?.circle_user_id) return json({ error: "No Circle wallet on this account" }, 400);

    const tokenRes = await circle("/users/token", {
      method: "POST",
      body: JSON.stringify({ userId: profile.circle_user_id }),
    });
    const userToken: string = tokenRes.data.userToken;

    const txRes = await circle(`/transactions/${transactionId}`, {
      method: "GET",
      headers: { "X-User-Token": userToken },
    });
    const tx = txRes?.data?.transaction ?? txRes?.data ?? {};

    return json({
      state: tx.state ?? null,
      tx_hash: tx.txHash ?? null,
      blockchain: tx.blockchain ?? null,
    });
  } catch (e) {
    console.error("circle-tx-status", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
