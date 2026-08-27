// Circle native Social Login (Google) support.
//
// Two actions, both callable without a Supabase session (the user has none yet):
//   - "deviceToken": proxies Circle POST /v1/w3s/users/social/token so the
//     browser SDK can start a Google social login. The CIRCLE_API_KEY never
//     leaves the server.
//   - "complete": called after the Circle SDK returns a userToken. Verifies the
//     token against Circle, provisions / syncs an SCA wallet on Arc, links the
//     Google email to a Supabase user and returns a one-time token the client
//     exchanges for a session.
//
// Self-custody (SIWE) sign-in is untouched by this function.

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

const SELF_CUSTODY_EMAIL_DOMAIN = "@wallet.monast.io";

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
  if (!res.ok) throw new Error(`Circle ${path} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action ?? "");

    // ---- 1. Device token for the browser SDK -------------------------------
    if (action === "deviceToken") {
      const deviceId = String(payload?.deviceId ?? "").trim();
      if (!deviceId || deviceId.length > 200) return json({ error: "deviceId is required" }, 400);

      const res = await circle("/users/social/token", {
        method: "POST",
        body: JSON.stringify({ deviceId, idempotencyKey: crypto.randomUUID() }),
      });
      const data = res?.data ?? {};
      const deviceToken = data.deviceToken;
      const deviceEncryptionKey = data.deviceEncryptionKey ?? data.encryptionKey;
      if (!deviceToken || !deviceEncryptionKey) {
        return json({ error: "Circle did not return a device token" }, 502);
      }
      return json({ deviceToken, deviceEncryptionKey });
    }

    // ---- 2. Persist a wallet created by the first-time PIN challenge -------
    if (action === "syncWallet") {
      const userToken = String(payload?.userToken ?? "");
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!userToken) return json({ error: "userToken is required" }, 400);
      if (!jwt) return json({ error: "Authentication is required" }, 401);

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: authData, error: authError } = await admin.auth.getUser(jwt);
      if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

      const me = await circle("/user", {
        method: "GET",
        headers: { "X-User-Token": userToken },
      });
      const circleUserId: string | undefined = me?.data?.user?.id ?? me?.data?.id;
      if (!circleUserId) return json({ error: "Could not verify the Circle session" }, 401);

      const { data: profile } = await admin
        .from("profiles")
        .select("circle_user_id")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (!profile || profile.circle_user_id !== circleUserId) {
        return json({ error: "Circle identity does not match this account" }, 403);
      }

      const walletsRes = await circle("/wallets", {
        method: "GET",
        headers: { "X-User-Token": userToken },
      });
      const wallets = walletsRes?.data?.wallets ?? [];
      if (wallets.length === 0) {
        return json({ error: "Arc wallet is not ready yet", code: "wallet_not_ready" }, 409);
      }

      for (const wallet of wallets) {
        await admin.from("user_wallets").upsert(
          {
            user_id: authData.user.id,
            address: String(wallet.address).toLowerCase(),
            circle_wallet_id: wallet.id,
            kind: "email_circle",
            chain_id: null,
            label: wallet.blockchain,
            is_primary: false,
          },
          { onConflict: "user_id,address" },
        );
      }
      await admin
        .from("profiles")
        .update({ circle_wallet_address: wallets[0].address, circle_wallet_id: wallets[0].id })
        .eq("id", authData.user.id);

      return json({ status: "ready", wallets });
    }

    // ---- 3. Finish social login: wallet + Supabase session -----------------
    if (action === "complete") {
      const userToken = String(payload?.userToken ?? "");
      const rawEmail = String(payload?.email ?? "").trim().toLowerCase();
      // Circle's Social Login refresh token (14-day life). Persisted so paying
      // later can mint a fresh userToken without another Google round-trip.
      const refreshToken = payload?.refreshToken ? String(payload.refreshToken) : null;
      // Circle's /users/token/refresh requires the deviceId the session was
      // minted with, so it is stored next to the refresh token.
      const sessionDeviceId = payload?.deviceId ? String(payload.deviceId) : null;
      if (!userToken) return json({ error: "userToken is required" }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
        return json({ error: "A Google email is required" }, 400);
      }
      if (rawEmail.endsWith(SELF_CUSTODY_EMAIL_DOMAIN)) {
        return json({ error: "Invalid email domain" }, 400);
      }

      // Proves the social login really happened and gives us Circle's user id.
      const me = await circle("/user", {
        method: "GET",
        headers: { "X-User-Token": userToken },
      });
      const circleUserId: string | undefined = me?.data?.user?.id ?? me?.data?.id;
      if (!circleUserId) return json({ error: "Could not verify the Circle session" }, 401);

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

      // Link (or create) the Supabase user for this Google email and mint a
      // one-time token the client swaps for a session.
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: rawEmail,
      });
      if (linkErr || !link?.user) {
        return json({ error: linkErr?.message ?? "Could not start the session" }, 500);
      }
      const authUserId = link.user.id;
      const tokenHash = (link.properties as { hashed_token?: string } | null)?.hashed_token;
      if (!tokenHash) return json({ error: "Could not start the session" }, 500);

      if (refreshToken) {
        await admin.from("circle_sessions").upsert(
          {
            user_id: authUserId,
            refresh_token: refreshToken,
            user_token: userToken,
            device_id: sessionDeviceId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }

      // Guard: never let a Circle identity take over an account that already
      // belongs to a different Circle user (or to a self-custody wallet).
      const { data: profile } = await admin
        .from("profiles")
        .select("id, circle_user_id")
        .eq("id", authUserId)
        .maybeSingle();

      if (profile?.circle_user_id && profile.circle_user_id !== circleUserId) {
        // A legacy record from the old email/OTP path may exist but never have
        // been completed (no wallet, no PIN). Such a record is stale and the
        // social identity may adopt it. A record that actually owns a wallet is
        // a real conflict and is still refused.
        const legacy = await circle(`/wallets?userId=${profile.circle_user_id}`, {
          method: "GET",
        }).catch(() => null);
        const legacyWallets = legacy?.data?.wallets ?? [];

        if (legacyWallets.length > 0) {
          return json(
            {
              error: "This email is already linked to another wallet",
              code: "circle_identity_conflict",
            },
            409,
          );
        }

        await admin
          .from("profiles")
          .update({ circle_user_id: circleUserId })
          .eq("id", authUserId);
      }

      if (!profile) {
        await admin.from("profiles").insert({ id: authUserId, circle_user_id: circleUserId });
      } else if (!profile.circle_user_id) {
        await admin.from("profiles").update({ circle_user_id: circleUserId }).eq("id", authUserId);
      }

      // Wallet: reuse an existing one, otherwise start an SCA init challenge.
      const walletsRes = await circle("/wallets", {
        method: "GET",
        headers: { "X-User-Token": userToken },
      }).catch(() => ({ data: { wallets: [] } }));
      const wallets = walletsRes?.data?.wallets ?? [];

      if (wallets.length > 0) {
        for (const w of wallets) {
          await admin.from("user_wallets").upsert(
            {
              user_id: authUserId,
              address: String(w.address).toLowerCase(),
              circle_wallet_id: w.id,
              kind: "email_circle",
              chain_id: null,
              label: w.blockchain,
              is_primary: false,
            },
            { onConflict: "user_id,address" },
          );
        }
        await admin
          .from("profiles")
          .update({ circle_wallet_address: wallets[0].address, circle_wallet_id: wallets[0].id })
          .eq("id", authUserId);

        return json({ status: "ready", tokenHash, email: rawEmail, wallets });
      }

      let initRes: { data?: { challengeId?: string } } | null = null;
      try {
        initRes = await circle("/user/initialize", {
          method: "POST",
          headers: { "X-User-Token": userToken },
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            blockchains: BLOCKCHAINS,
            accountType: "SCA",
          }),
        });
      } catch (e) {
        // Code 155106 = this Circle user was already initialized by an earlier,
        // never-completed attempt (e.g. an interrupted login before a bug fix).
        // There's no new challenge to run in that case - re-check for a wallet
        // instead of treating this as a hard failure.
        const msg = (e as Error).message;
        if (!msg.includes("155106")) throw e;

        const retryWallets = await circle("/wallets", {
          method: "GET",
          headers: { "X-User-Token": userToken },
        }).catch(() => ({ data: { wallets: [] } }));
        const existing = retryWallets?.data?.wallets ?? [];

        if (existing.length > 0) {
          for (const w of existing) {
            await admin.from("user_wallets").upsert(
              {
                user_id: authUserId,
                address: String(w.address).toLowerCase(),
                circle_wallet_id: w.id,
                kind: "email_circle",
                chain_id: null,
                label: w.blockchain,
                is_primary: false,
              },
              { onConflict: "user_id,address" },
            );
          }
          await admin
            .from("profiles")
            .update({ circle_wallet_address: existing[0].address, circle_wallet_id: existing[0].id })
            .eq("id", authUserId);

          return json({ status: "ready", tokenHash, email: rawEmail, wallets: existing });
        }

        // Genuinely stuck: initialized on Circle's side, but the PIN challenge
        // was never completed and no wallet exists. Surface this clearly
        // instead of silently returning a broken "challenge" response.
        return json(
          {
            error:
              "Your wallet setup was started but never finished. Contact support to reset it, or try a different Google account.",
            code: "stuck_uninitialized",
          },
          409,
        );
      }

      const challengeId = initRes?.data?.challengeId;
      if (!challengeId) {
        // Defensive: never claim "challenge" status without a real challengeId -
        // this was silently swallowed before, producing a fake "success" with
        // no PIN prompt and no wallet.
        return json({ error: "Circle did not return a wallet setup challenge" }, 502);
      }

      return json({ status: "challenge", challengeId, tokenHash, email: rawEmail });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("circle-social error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
