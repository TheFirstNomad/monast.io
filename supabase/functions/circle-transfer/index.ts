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
import { pickTransfer, type CircleTx } from "./pickTransfer.ts";

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
 * need a fresh Google popup. The userToken itself is valid for ~60 minutes, so
 * it is cached with its expiry: balance reads, activity lists and status polls
 * then cost ONE Circle call instead of two.
 */
const TOKEN_SAFETY_MS = 5 * 60 * 1000;

async function getFreshUserSession(admin: any, userId: string, forceRefresh = false) {
  const { data: session } = await admin
    .from("circle_sessions")
    .select("refresh_token, user_token, device_id, user_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  // Circle rejects a partial refresh with a bare 403 "userToken is invalid",
  // so never call it without all three pieces of the session.
  if (!session?.refresh_token || !session?.user_token || !session?.device_id) {
    throw new Error("Your wallet session expired. Please sign in with Google again.");
  }

  if (!forceRefresh && session.user_token_expires_at) {
    const expiresAt = new Date(session.user_token_expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt - Date.now() > TOKEN_SAFETY_MS) {
      return { userToken: session.user_token as string, encryptionKey: "" };
    }
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
      // Circle userTokens are valid for 60 minutes.
      user_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return {
    userToken: data.userToken as string,
    encryptionKey: (data.encryptionKey ?? data.deviceEncryptionKey ?? "") as string,
  };
}

/**
 * A cached userToken can still be rejected by Circle (rotation elsewhere, or a
 * clock skew). Retry exactly once with a forced refresh so the UI never shows a
 * spurious "session expired".
 */
async function withUserSession<T>(
  admin: any,
  userId: string,
  run: (session: { userToken: string; encryptionKey: string }) => Promise<T>,
): Promise<T> {
  const session = await getFreshUserSession(admin, userId);
  try {
    return await run(session);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (!/155105|401|403/.test(msg)) throw e;
    const fresh = await getFreshUserSession(admin, userId, true);
    return await run(fresh);
  }
}

async function listTransfers(userToken: string, walletId: string): Promise<CircleTx[]> {
  const qs = new URLSearchParams({
    walletIds: walletId,
    pageSize: "50",
    // Circle's user-transaction list is newest-first by default.
    operation: "TRANSFER",
  });
  const res = await circle(`/user/transactions?${qs.toString()}`, {
    method: "GET",
    headers: { "X-User-Token": userToken },
  });
  return res?.data?.transactions ?? [];
}

async function findTransfer(input: {
  userToken: string;
  walletId: string;
  destinationAddress: string;
  amountUsdc: number;
}): Promise<CircleTx | null> {
  const txs = (await listTransfers(input.userToken, input.walletId)).filter(
    (t: any) => String(t.transactionType ?? "OUTBOUND").toUpperCase() === "OUTBOUND",
  );
  return pickTransfer(txs, input.destinationAddress, input.amountUsdc);
}

/** USDC balance of a user-controlled wallet, as an exact decimal number. */
async function usdcBalance(userToken: string, walletId: string): Promise<number> {
  const res = await circle(`/wallets/${walletId}/balances`, {
    method: "GET",
    headers: { "X-User-Token": userToken },
  });
  const balances: any[] = res?.data?.tokenBalances ?? [];
  const usdc = balances.find(
    (b) =>
      b?.token?.id === CIRCLE_USDC_TOKEN_ID ||
      String(b?.token?.symbol ?? "").toUpperCase().includes("USDC"),
  );
  return Number(usdc?.amount ?? 0);
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

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    // Read-only actions get a much higher ceiling: the client polls a transfer
    // every 1.5s, which used to exhaust the write limit mid-payment.
    const READ_ACTIONS = ["status", "balance", "activity", "resolve"];
    const limitKey = action === "withdraw"
      ? "circle-withdraw"
      : READ_ACTIONS.includes(action)
        ? "circle-transfer-read"
        : "circle-transfer";
    const rl = await checkUserRateLimit(admin, userId, limitKey);
    if (!rl.ok) return json(rateLimitBody(rl), 429);


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

      // A challenge needs the encryptionKey Circle only hands back on refresh,
      // so force one for createChallenge; `resolve` is a read and can reuse the
      // cached token.
      const session = await getFreshUserSession(admin, userId, action === "createChallenge");


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
      const t = await withUserSession(admin, userId, async (s) => {
        const tx = await circle(`/user/transactions/${transactionId}`, {
          method: "GET",
          headers: { "X-User-Token": s.userToken },
        });
        return tx?.data?.transaction;
      });
      return json({
        status: t?.state ?? "PENDING",
        txHash: t?.txHash ?? null,
        message: t?.errorReason ?? t?.errorDetails ?? null,
      });
    }

    // ---- Wallet home: balance, activity, withdraw -------------------------
    if (action === "balance" || action === "activity" || action === "withdraw") {
      const { data: profile } = await admin
        .from("profiles")
        .select("circle_wallet_id, circle_wallet_address")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.circle_wallet_id) return json({ error: "No Circle wallet on file" }, 400);
      const walletId = profile.circle_wallet_id as string;
      const myAddress = String(profile.circle_wallet_address ?? "").toLowerCase();

      if (action === "balance") {
        const amount = await withUserSession(admin, userId, (s) => usdcBalance(s.userToken, walletId));
        return json({ balanceUsdc: amount, address: profile.circle_wallet_address, chainId: ARC_CHAIN_ID });
      }

      if (action === "activity") {
        const txs = await withUserSession(admin, userId, (s) => listTransfers(s.userToken, walletId));
        return json({
          transactions: txs.slice(0, 25).map((t: any) => ({
            id: t.id ?? null,
            direction: String(t.transactionType ?? "OUTBOUND").toUpperCase(),
            amountUsdc: Number(t.amounts?.[0] ?? 0),
            counterparty: t.destinationAddress ?? t.sourceAddress ?? null,
            state: t.state ?? null,
            txHash: t.txHash ?? null,
            createdAt: t.createDate ?? t.createdAt ?? null,
          })),
        });
      }

      // withdraw
      if (!CIRCLE_USDC_TOKEN_ID) {
        return json({ error: "Wallet transfers are not configured yet (missing USDC token id)." }, 503);
      }
      const to = String(body?.destinationAddress ?? "").trim();
      const amount = Number(body?.amountUsdc);
      const requestId = String(body?.clientRequestId ?? "").trim().slice(0, 64);

      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
        return json({ error: "Enter a valid Arc wallet address (0x followed by 40 characters)." }, 400);
      }
      if (to.toLowerCase() === myAddress) {
        return json({ error: "That is this wallet's own address. Enter a different destination." }, 400);
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return json({ error: "Enter an amount greater than zero." }, 400);
      }
      if (requestId && !/^[A-Za-z0-9_.:-]+$/.test(requestId)) {
        return json({ error: "Invalid request id" }, 400);
      }

      const session = await getFreshUserSession(admin, userId, true);
      const balance = await usdcBalance(session.userToken, walletId);
      if (toBaseUnits(amount) > toBaseUnits(balance)) {
        return json(
          { error: `This wallet holds ${formatUsdc(toBaseUnits(balance))} USDC; you cannot send ${amount}.` },
          400,
        );
      }

      const transfer = await circle("/user/transactions/transfer", {
        method: "POST",
        headers: { "X-User-Token": session.userToken },
        body: JSON.stringify({
          // Derived from the exact withdrawal request, so a double-click reuses
          // the same Circle transfer instead of sending twice.
          idempotencyKey: await idempotencyKeyFor(
            `withdraw:${userId}:${to.toLowerCase()}:${formatUsdc(toBaseUnits(amount))}:${requestId || "manual"}`,
          ),
          walletId,
          destinationAddress: to,
          tokenId: CIRCLE_USDC_TOKEN_ID,
          amounts: [formatUsdc(toBaseUnits(amount))],
          feeLevel: "MEDIUM",
        }),
      });

      const challengeId = transfer?.data?.challengeId;
      if (!challengeId) return json({ error: "Circle did not return a transfer challenge" }, 502);

      return json({
        challengeId,
        userToken: session.userToken,
        encryptionKey: session.encryptionKey,
        chainId: ARC_CHAIN_ID,
        amountUsdc: amount,
        destinationAddress: to,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("circle-transfer error", err);
    return json({ error: (err as Error).message }, 500);
  }

});

