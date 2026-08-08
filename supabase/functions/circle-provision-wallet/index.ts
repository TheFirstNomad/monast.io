// Circle User-Controlled Wallets provisioning.
// Idempotent: safe to call after every email login. If the current auth user
// already has a `profiles.circle_user_id`, we short-circuit and return an
// initialization challenge for PIN setup instead of creating a new user.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CIRCLE_BASE = "https://api.circle.com/v1/w3s";
const CIRCLE_API_KEY = Deno.env.get("CIRCLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Chains we provision for User-Controlled Wallets. monast.io is Arc-native, so
// only Arc is provisioned. CIRCLE_UCW_BLOCKCHAINS can override the identifier
// if Circle renames it, without a redeploy.
const BLOCKCHAINS = (Deno.env.get("CIRCLE_UCW_BLOCKCHAINS") ?? "ARC-TESTNET")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

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
  if (!res.ok) {
    throw new Error(`Circle ${path} ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: use the caller's JWT to identify the current user.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const asUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
    const user = userRes.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load or create profile row.
    let { data: profile } = await admin
      .from("profiles")
      .select("id, circle_user_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      const { data: inserted, error: insErr } = await admin
        .from("profiles")
        .insert({ id: user.id })
        .select("id, circle_user_id")
        .single();
      if (insErr) throw insErr;
      profile = inserted;
    }

    // 1. Ensure a Circle userId exists.
    let circleUserId = profile.circle_user_id;
    if (!circleUserId) {
      circleUserId = crypto.randomUUID();
      await circle("/users", {
        method: "POST",
        body: JSON.stringify({ userId: circleUserId }),
      });
      await admin.from("profiles").update({ circle_user_id: circleUserId }).eq("id", user.id);
    }

    // 2. Mint a userToken + encryption key that the client SDK uses to set/enter the PIN.
    const tokenRes = await circle("/users/token", {
      method: "POST",
      body: JSON.stringify({ userId: circleUserId }),
    });
    const userToken: string = tokenRes.data.userToken;
    const encryptionKey: string = tokenRes.data.encryptionKey;

    // 3. Check if user already has a wallet set initialised. If so, return status only.
    const walletsRes = await circle(`/wallets?userId=${circleUserId}`, {
      method: "GET",
      headers: { "X-User-Token": userToken },
    }).catch(() => ({ data: { wallets: [] } }));

    const existing = walletsRes?.data?.wallets ?? [];

    if (existing.length > 0) {
      // Sync addresses to user_wallets (idempotent per (user_id,address)).
      for (const w of existing) {
        await admin
          .from("user_wallets")
          .upsert(
            {
              user_id: user.id,
              address: (w.address as string).toLowerCase(),
              kind: "email_circle",
              chain_id: null,
              label: w.blockchain,
              is_primary: false,
            },
            { onConflict: "user_id,address" },
          );
      }
      // Also store a primary address on profiles for quick reads.
      const primary = existing[0]?.address;
      if (primary) {
        await admin.from("profiles").update({ circle_wallet_address: primary }).eq("id", user.id);
      }
      return json({
        status: "ready",
        userToken,
        encryptionKey,
        wallets: existing,
      });
    }

    // 4. Kick off the PIN + wallet initialization challenge.
    const initRes = await circle("/user/initialize", {
      method: "POST",
      headers: { "X-User-Token": userToken },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        blockchains: BLOCKCHAINS,
        accountType: "SCA",
      }),
    });

    return json({
      status: "challenge",
      userToken,
      encryptionKey,
      challengeId: initRes.data.challengeId,
    });
  } catch (err) {
    console.error("circle-provision-wallet error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
