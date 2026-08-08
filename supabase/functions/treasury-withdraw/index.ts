// Owner-only revenue withdrawal. Moves USDC out of the REVENUE treasury wallet
// to any address the owner supplies. The escrow wallet is deliberately not
// reachable from here — user funds have no withdrawal path.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { verifyAdmin } from "../_shared/admin-auth.ts";
import { getTreasury } from "../_shared/treasury.ts";
import { treasuryTransfer, walletBalance } from "../_shared/circle-dev.ts";
import { writeLedger } from "../_shared/ledger.ts";
import { formatUsdc, toBaseUnits } from "../_shared/fees.ts";
import { checkUserRateLimit, rateLimitBody } from "../_shared/user-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    if (!(await verifyAdmin(req, admin))) return json({ error: "Forbidden" }, 403);
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // Keyed by the admin wallet that signed the request, so even a UI bug or a
    // stolen signature window cannot fire withdrawals in a loop.
    const adminAddr = (req.headers.get("x-admin-address") ?? "unknown").toLowerCase();
    const rl = await checkUserRateLimit(admin, adminAddr, "treasury-withdraw");
    if (!rl.ok) return json(rateLimitBody(rl), 429);

    const body = await req.json().catch(() => ({}));
    const chainId = Number(body.chain_id ?? 5042002);
    const to = String(body.destination_address ?? "").trim();
    const amount = Number(body.amount_usdc);

    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) return json({ error: "destination_address is not a valid address" }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "amount_usdc must be positive" }, 400);
    if (!Number.isInteger(chainId) || chainId <= 0) return json({ error: "chain_id invalid" }, 400);

    const revenue = await getTreasury(admin, "revenue", chainId);
    if (!revenue.circle_wallet_id) return json({ error: "Revenue wallet is not linked to Circle" }, 400);

    // Never let a withdrawal exceed the wallet's actual balance.
    const balances = await walletBalance(revenue.circle_wallet_id);
    const usdc = Number(
      balances.find((b) => b.token?.symbol?.toUpperCase().includes("USDC"))?.amount ?? "0",
    );
    if (amount > usdc) {
      return json({ error: `Revenue wallet holds ${usdc} USDC; cannot withdraw ${amount}` }, 400);
    }

    // Deterministic key: no timestamp, so a retry of the SAME attempt reuses it
    // and Circle dedupes. A genuinely new withdrawal supplies a new
    // client_request_id (the admin UI generates one per button press).
    const requestId = String(body.client_request_id ?? "").trim().slice(0, 64) || "manual";
    if (!/^[A-Za-z0-9_.:-]+$/.test(requestId)) {
      return json({ error: "client_request_id has invalid characters" }, 400);
    }
    const idempotencyKey =
      `withdrawal:${chainId}:${to.toLowerCase()}:${amount}:${requestId}`;

    // Concurrency guard: the unique index on idempotency_key means only one
    // caller can claim this withdrawal. Two parallel requests -> one transfer.
    const { error: claimErr } = await admin
      .from("treasury_withdrawal_claims")
      .insert({
        idempotency_key: idempotencyKey,
        chain_id: chainId,
        destination_address: to,
        amount_usdc: amount,
        status: "in_progress",
      });
    if (claimErr) {
      if ((claimErr as any).code === "23505") {
        console.error("WITHDRAWAL_BLOCKED", JSON.stringify({ idempotencyKey }));
        return json(
          {
            error:
              "A withdrawal for this exact request is already in progress or complete. " +
              "Refresh the treasury page to see its status before trying again.",
          },
          409,
        );
      }
      throw claimErr;
    }

    let tx: { id: string };
    try {
      tx = await treasuryTransfer({
        walletId: revenue.circle_wallet_id,
        destinationAddress: to,
        // Exact decimal from integer micro-USDC.
        amountUsdc: formatUsdc(toBaseUnits(amount)),
        chainId,
        idempotencyKey,
      });
    } catch (e) {
      // Leave the claim row behind, marked failed: a retry of the same attempt
      // must not open a fresh slot, and Circle dedupes on the same key anyway.
      await admin
        .from("treasury_withdrawal_claims")
        .update({ status: "failed", error: (e as Error).message })
        .eq("idempotency_key", idempotencyKey);
      throw e;
    }

    await admin
      .from("treasury_withdrawal_claims")
      .update({ status: "sent", circle_transaction_id: tx.id })
      .eq("idempotency_key", idempotencyKey);

    await writeLedger(admin, {
      kind: "revenue_withdrawal",
      chainId,
      amountUsdc: amount,
      circleTransactionId: tx.id,
      status: "pending",
      idempotencyKey,
      notes: `owner withdrawal to ${to}`,
    });

    return json({ circle_transaction_id: tx.id, amount_usdc: amount, destination_address: to });
  } catch (e) {
    console.error("treasury-withdraw", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
