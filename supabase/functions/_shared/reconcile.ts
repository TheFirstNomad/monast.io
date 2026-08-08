// Payout reconciliation: closes the loop between "Circle accepted the transfer"
// and "the money actually landed".
//
// runPayout marks an escrow `payout_status: "sent"` as soon as Circle accepts
// the request. That is not confirmation. This pass asks Circle for the real
// state of each in-flight transaction and records the outcome, so the books
// stop claiming success for transfers that later failed.

import { getTransaction } from "./circle-dev.ts";
import { updateLedgerStatus } from "./ledger.ts";

const SETTLE_DELAY_MS = 2 * 60 * 1000; // give Circle a couple of minutes
const BATCH = 50;

const COMPLETE_STATES = ["COMPLETE", "CONFIRMED"];
const FAILED_STATES = ["FAILED", "CANCELLED", "DENIED"];

export interface ReconcileReport {
  checked: number;
  confirmed: string[];
  failed: string[];
  still_pending: string[];
  errors: { escrow_id?: string; ledger_key?: string; error: string }[];
}

async function raiseAlert(
  admin: any,
  a: {
    kind: string;
    escrowId?: string | null;
    circleTransactionId?: string | null;
    idempotencyKey?: string | null;
    amountUsdc?: number | null;
    detail: string;
  },
) {
  console.error(
    "RECONCILE_FAILURE",
    JSON.stringify({
      kind: a.kind,
      escrow_id: a.escrowId ?? null,
      circle_transaction_id: a.circleTransactionId ?? null,
      amount_usdc: a.amountUsdc ?? null,
      detail: a.detail,
    }),
  );
  const { error } = await admin.from("payout_alerts").insert({
    kind: a.kind,
    escrow_id: a.escrowId ?? null,
    circle_transaction_id: a.circleTransactionId ?? null,
    idempotency_key: a.idempotencyKey ?? null,
    amount_usdc: a.amountUsdc ?? null,
    detail: a.detail,
  });
  // 23505 = the same alert already exists; nothing to add.
  if (error && (error as any).code !== "23505") {
    console.error("payout_alerts insert failed", (error as any).message);
  }
}

/**
 * Reconciles escrow payouts and pending ledger rows against Circle.
 *
 * Escrow status (`released` / `refunded`) is deliberately NOT rewritten on a
 * failed transfer — the payout_status and the alert record the truth, and
 * undoing a user-visible state machine automatically is not safe.
 */
export async function reconcilePayouts(admin: any): Promise<ReconcileReport> {
  const cutoff = new Date(Date.now() - SETTLE_DELAY_MS).toISOString();
  const report: ReconcileReport = {
    checked: 0,
    confirmed: [],
    failed: [],
    still_pending: [],
    errors: [],
  };

  // ---- 1. Escrows whose payout Circle accepted but never confirmed ---------
  const { data: sent } = await admin
    .from("escrows")
    .select("id, payout_circle_tx_id, payout_status, payout_started_at, seller_net_usdc, amount_usdc")
    .eq("payout_status", "sent")
    .not("payout_circle_tx_id", "is", null)
    .lte("payout_started_at", cutoff)
    .limit(BATCH);

  for (const esc of sent ?? []) {
    report.checked++;
    try {
      const tx = await getTransaction(esc.payout_circle_tx_id);
      const state = String(tx?.state ?? "").toUpperCase();

      if (COMPLETE_STATES.includes(state)) {
        await admin
          .from("escrows")
          .update({ payout_status: "confirmed" })
          .eq("id", esc.id);
        // The ledger key is deterministic, so both possible payout kinds are
        // updated by key without needing to know which one ran.
        for (const kind of ["release", "refund"]) {
          await updateLedgerStatus(admin, `escrow:${esc.id}:${kind}`, {
            status: "confirmed",
            txHash: tx.txHash ?? null,
          });
        }
        report.confirmed.push(esc.id);
      } else if (FAILED_STATES.includes(state)) {
        await admin
          .from("escrows")
          .update({ payout_status: "failed" })
          .eq("id", esc.id);
        for (const kind of ["release", "refund"]) {
          await updateLedgerStatus(admin, `escrow:${esc.id}:${kind}`, {
            status: "failed",
            notes: `circle state ${state}${tx?.errorReason ? `: ${tx.errorReason}` : ""}`,
          });
        }
        await raiseAlert(admin, {
          kind: "payout_failed",
          escrowId: esc.id,
          circleTransactionId: esc.payout_circle_tx_id,
          idempotencyKey: null,
          amountUsdc: Number(esc.seller_net_usdc ?? esc.amount_usdc ?? 0),
          detail: `Circle reported ${state}${tx?.errorReason ? `: ${tx.errorReason}` : ""}. The escrow still shows a completed state to users.`,
        });
        report.failed.push(esc.id);
      } else {
        report.still_pending.push(esc.id);
      }
    } catch (e) {
      const msg = (e as Error).message;
      report.errors.push({ escrow_id: esc.id, error: msg });
      // A transaction id Circle does not recognise is itself a red flag.
      if (/404|not found/i.test(msg)) {
        await admin.from("escrows").update({ payout_status: "failed" }).eq("id", esc.id);
        await raiseAlert(admin, {
          kind: "payout_unknown_transaction",
          escrowId: esc.id,
          circleTransactionId: esc.payout_circle_tx_id,
          amountUsdc: Number(esc.seller_net_usdc ?? esc.amount_usdc ?? 0),
          detail: `Circle does not recognise transaction ${esc.payout_circle_tx_id}: ${msg}`,
        });
        report.failed.push(esc.id);
      }
    }
  }

  // ---- 2. Pending ledger rows with a Circle id (fee sweeps, withdrawals) ---
  const { data: pendingLedger } = await admin
    .from("ledger_entries")
    .select("id, idempotency_key, circle_transaction_id, kind, amount_usdc, escrow_id")
    .eq("status", "pending")
    .not("circle_transaction_id", "is", null)
    .lte("created_at", cutoff)
    .limit(BATCH);

  for (const row of pendingLedger ?? []) {
    report.checked++;
    try {
      const tx = await getTransaction(row.circle_transaction_id);
      const state = String(tx?.state ?? "").toUpperCase();
      if (COMPLETE_STATES.includes(state)) {
        await updateLedgerStatus(admin, row.idempotency_key, {
          status: "confirmed",
          txHash: tx.txHash ?? null,
        });
      } else if (FAILED_STATES.includes(state)) {
        await updateLedgerStatus(admin, row.idempotency_key, {
          status: "failed",
          notes: `circle state ${state}${tx?.errorReason ? `: ${tx.errorReason}` : ""}`,
        });
        await raiseAlert(admin, {
          kind: `ledger_failed:${row.kind}`,
          escrowId: row.escrow_id,
          circleTransactionId: row.circle_transaction_id,
          idempotencyKey: row.idempotency_key,
          amountUsdc: Number(row.amount_usdc ?? 0),
          detail: `Circle reported ${state} for ${row.kind}${tx?.errorReason ? `: ${tx.errorReason}` : ""}.`,
        });
      }
    } catch (e) {
      report.errors.push({ ledger_key: row.idempotency_key, error: (e as Error).message });
    }
  }

  return report;
}
