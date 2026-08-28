// Circle-wallet payments: starts (and reports on) a USDC transfer signed by a
// user-controlled Circle wallet.
//
// Self-custody payers sign in their own wallet and never need this function.
// Circle-wallet users cannot sign locally, so the server initiates the transfer
// with Circle and returns a challenge the browser SDK finishes. Verification and
// payout stay exactly where they already are (escrow-confirm-funded,
// ad-listing-fee, promote-checkout) - this only produces the txHash they expect.
//
// POST { action: "createChallenge", purpose, referenceId }
// POST { action: "status", transactionId }

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getTreasury, isTreasuryMissing } from "../_shared/treasury.ts";
import { loadFeeSettings, formatUsdc, toBaseUnits } from "../_shared/fees.ts";
import { checkUserRateLimit, rateLimitBody } from "../_shared/user-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CIRCLE_BASE = "https://api.circle.com/v1/w3s";
const CIRCLE_API_KEY = Deno.env.get("CIRCLE_API_KEY")!;
const CIRCLE_USDC_TOKEN_ID = Deno.env.get("CIRCLE_USDC_TOKEN_ID_ARC_TESTNET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Arc Testnet - the only chain monast.io settles on today. `ads` has no
// chain_id column, so listing / promotion fees are always paid here.
const ARC_CHAIN_ID = 5042002;

type Tier = "24h" | "7d" | "30d";
// Must stay identical to TIERS in promote-checkout/index.ts, which is what
// actually verifies the payment. If those prices change, change them here too.
const TIERS: Record<Tier, { price: number; hours: number }> = {
  "24h": { price: 5, hours: 24 },
  "7d": { price: 25, hours: 24 * 7 },
  "30d": { price: 80, hours: 24 * 30 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function circle(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CIRCLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Circle ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Circle requires a UUID idempotency key. Deriving it from purpose+reference
 * means an accidental double-submit reuses the same transfer instead of
 * charging the user twice.
 */
async function idempotencyKeyFor(seed: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)),
  );
  const hex = [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Circle Social Login sessions are refreshable for 14 days, so paying does not
 * need a fresh Google popup. The refresh token is rotated on every use.
 */
async function getFreshUserSession(admin: any, userId: string) {
  const { data: session } = await admin
    .from("circle_sessions")
    .select("refresh_token, user_token, device_id")
    .eq("user_id", userId)
    .maybeSingle();
  // Circle rejects a partial refresh with a bare 403 "userToken is invalid",
  // so never call it without all three pieces of the session.
  if (!session?.refresh_token || !session?.user_token || !session?.device_id) {
    throw new Error("Your wallet session expired. Please sign in with Google again.");
  }

  const refreshed = await circle("/users/token/refresh", {
    method: "POST",
    headers: { "X-User-Token": session.user_token },
    body: JSON.stringify({
      refreshToken: session.refresh_token,
      deviceId: session.device_id,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  const data = refreshed?.data ?? {};
  if (!data.userToken) throw new Error("Circle did not return a wallet session");

  await admin
    .from("circle_sessions")
    .update({
      user_token: data.userToken,
      refresh_token: data.refreshToken ?? session.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return {
    userToken: data.userToken as string,
    encryptionKey: (data.encryptionKey ?? data.deviceEncryptionKey ?? "") as string,
  };
}

export interface CircleTx {
  id?: string;
  state?: string;
  txHash?: string | null;
  amounts?: string[];
  destinationAddress?: string;
  errorReason?: string | null;
  errorDetails?: string | null;
}

/**
 * Finds the outbound transfer for a given payment by matching wallet,
 * destination and amount. Prefers a completed transfer, then one still in
 * flight, so a caller can either settle immediately or keep polling.
 * Exported for tests.
 */
export function pickTransfer(txs: CircleTx[], destinationAddress: string, amountUsdc: number): CircleTx | null {
  const wanted = formatUsdc(toBaseUnits(amountUsdc));
  const dest = destinationAddress.toLowerCase();
  const matches = txs.filter((t) => {
    const amount = t.amounts?.[0];
    if (!amount) return false;
    let same = false;
    try {
      same = toBaseUnits(amount) === toBaseUnits(wanted);
    } catch {
      same = false;
    }
    return same && (t.destinationAddress ?? "").toLowerCase() === dest;
  });
  const rank = (t: CircleTx) => {
    const s = String(t.state ?? "").toUpperCase();
    if (t.txHash && (s === "COMPLETE" || s === "CONFIRMED")) return 0;
    if (["FAILED", "CANCELLED", "DENIED", "EXPIRED"].includes(s)) return 2;
    return 1;
  };
  matches.sort((a, b) => rank(a) - rank(b));
  return matches[0] ?? null;
}

async function findTransfer(input: {
  userToken: string;
  walletId: string;
  destinationAddress: string;
  amountUsdc: number;
}): Promise<CircleTx | null> {
  const qs = new URLSearchParams({
    walletIds: input.walletId,
    pageSize: "50",
    // Circle's user-transaction list is newest-first by default.
    operation: "TRANSFER",
    transactionDirection: "OUTBOUND",
  });
  const res = await circle(`/user/transactions?${qs.toString()}`, {
    method: "GET",
    headers: { "X-User-Token": input.userToken },
  });
  const txs: CircleTx[] = res?.data?.transactions ?? [];
  return pickTransfer(txs, input.destinationAddress, input.amountUsdc);
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const asUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const rl = await checkUserRateLimit(admin, userId, "circle-transfer");
    if (!rl.ok) return json(rateLimitBody(rl), 429);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "createChallenge" || action === "resolve") {
      if (!CIRCLE_USDC_TOKEN_ID) {
        return json(
          { error: "Circle-wallet payments are not configured yet (missing USDC token id)." },
          503,
        );
      }
      const purpose = String(body?.purpose ?? "") as
        | "escrow_fund"
        | "listing_fee"
        | "promote_checkout";
      const referenceId = String(body?.referenceId ?? "");
      if (!purpose || !referenceId) return json({ error: "Missing purpose or referenceId" }, 400);

      const { data: profile } = await admin
        .from("profiles")
        .select("circle_wallet_id")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.circle_wallet_id) return json({ error: "No Circle wallet on file" }, 400);

      let destinationAddress: string;
      let amountUsdc: number;
      let chainId = ARC_CHAIN_ID;

      try {
        if (purpose === "escrow_fund") {
          const { data: esc } = await admin
            .from("escrows")
            .select("amount_usdc, buyer_id, status, chain_id")
            .eq("id", referenceId)
            .maybeSingle();
          if (!esc || esc.buyer_id !== userId || esc.status !== "created") {
            return json({ error: "Escrow not found or not payable" }, 404);
          }
          chainId = Number(esc.chain_id) || ARC_CHAIN_ID;
          destinationAddress = (await getTreasury(admin, "escrow", chainId)).address;
          amountUsdc = Number(esc.amount_usdc);
        } else if (purpose === "listing_fee") {
          const { data: ad } = await admin
            .from("ads")
            .select("id, seller_id, status, listing_fee_usdc")
            .eq("id", referenceId)
            .maybeSingle();
          if (!ad || ad.seller_id !== userId) return json({ error: "Ad not found" }, 404);
          if (ad.status !== "pending_fee") {
            return json({ error: "This listing is not awaiting its publication fee" }, 409);
          }
          const fees = await loadFeeSettings(admin);
          destinationAddress = (await getTreasury(admin, "revenue", chainId)).address;
          // Pin the quoted fee to this listing so a later settings change cannot
          // invalidate a transfer that the user already approved.
          amountUsdc = Number(ad.listing_fee_usdc) > 0
            ? Number(ad.listing_fee_usdc)
            : fees.listingFeeUsdc;
          if (action === "createChallenge" && !(Number(ad.listing_fee_usdc) > 0)) {
            const { error: quoteError } = await admin
              .from("ads")
              .update({ listing_fee_usdc: amountUsdc })
              .eq("id", referenceId)
              .eq("status", "pending_fee");
            if (quoteError) throw quoteError;
          }
        } else if (purpose === "promote_checkout") {
          // referenceId format: "<ad_id>:<tier>"
          const [adId, tier] = String(referenceId).split(":");
          const conf = TIERS[tier as Tier];
          if (!conf) return json({ error: "Invalid tier" }, 400);
          const { data: ad } = await admin
            .from("ads")
            .select("id, seller_id")
            .eq("id", adId)
            .maybeSingle();
          if (!ad || ad.seller_id !== userId) return json({ error: "Ad not found" }, 404);
          destinationAddress = (await getTreasury(admin, "revenue", chainId)).address;
          amountUsdc = conf.price;
        } else {
          return json({ error: "Unknown purpose" }, 400);
        }
      } catch (e) {
        if (isTreasuryMissing(e)) return json({ error: (e as Error).message, configured: false }, 503);
        throw e;
      }

      const session = await getFreshUserSession(admin, userId);

      // Recovery path: Circle already holds the truth about this payment. Look
      // the transfer up by wallet + destination + amount instead of relying on
      // the browser having captured a transaction id, so a challenge result
      // that arrives without an id can never orphan money the user already sent.
      if (action === "resolve") {
        const found = await findTransfer({
          userToken: session.userToken,
          walletId: profile.circle_wallet_id,
          destinationAddress,
          amountUsdc,
        });
        return json({
          chainId,
          amountUsdc,
          transactionId: found?.id ?? null,
          status: found?.state ?? null,
          txHash: found?.txHash ?? null,
          message: found?.errorReason ?? found?.errorDetails ?? null,
        });
      }

      const transfer = await circle("/user/transactions/transfer", {
        method: "POST",
        headers: { "X-User-Token": session.userToken },
        body: JSON.stringify({
          idempotencyKey: await idempotencyKeyFor(`${purpose}:${referenceId}`),
          walletId: profile.circle_wallet_id,
          destinationAddress,
          tokenId: CIRCLE_USDC_TOKEN_ID,
          // Exact decimal string from integer micro-USDC - never a float.
          amounts: [formatUsdc(toBaseUnits(amountUsdc))],
          // REST field: the nested SDK-style `fee` object is ignored here, which
          // makes Circle treat the fee as unset and demand gasPrice/gasLimit.
          feeLevel: "MEDIUM",
        }),
      });

      // Circle's transfer-challenge response only carries a challengeId - the
      // transaction itself is created when the PIN challenge is executed, so
      // the client reads the transaction id from the challenge result, and
      // falls back to the `resolve` action above when it is absent.
      const challengeId = transfer?.data?.challengeId;
      if (!challengeId) return json({ error: "Circle did not return a payment challenge" }, 502);

      return json({
        challengeId,
        userToken: session.userToken,
        encryptionKey: session.encryptionKey,
        chainId,
        amountUsdc,
      });
    }

    if (action === "status") {
      const transactionId = String(body?.transactionId ?? "");
      if (!transactionId) return json({ error: "Missing transactionId" }, 400);
      const session = await getFreshUserSession(admin, userId);
      const tx = await circle(`/user/transactions/${transactionId}`, {
        method: "GET",
        headers: { "X-User-Token": session.userToken },
      });
      const t = tx?.data?.transaction;
      return json({
        status: t?.state ?? "PENDING",
        txHash: t?.txHash ?? null,
        message: t?.errorReason ?? t?.errorDetails ?? null,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("circle-transfer error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

