// Append-only money ledger writer. Every USDC movement gets exactly one row.
// `idempotencyKey` is UNIQUE in the database, so a retried call cannot duplicate
// an entry — a conflict is treated as success.

export type LedgerKind =
  | "escrow_deposit"
  | "seller_payout"
  | "buyer_refund"
  | "platform_fee"
  | "listing_fee"
  | "promotion_fee"
  | "revenue_withdrawal";

export interface LedgerEntry {
  kind: LedgerKind;
  chainId: number;
  amountUsdc: number;
  escrowId?: string | null;
  adId?: string | null;
  fromUserId?: string | null;
  toUserId?: string | null;
  txHash?: string | null;
  circleTransactionId?: string | null;
  status?: "pending" | "confirmed" | "failed";
  idempotencyKey: string;
  notes?: string | null;
}

export async function writeLedger(admin: any, e: LedgerEntry) {
  const { data, error } = await admin
    .from("ledger_entries")
    .insert({
      kind: e.kind,
      escrow_id: e.escrowId ?? null,
      ad_id: e.adId ?? null,
      from_user_id: e.fromUserId ?? null,
      to_user_id: e.toUserId ?? null,
      chain_id: e.chainId,
      amount_usdc: e.amountUsdc,
      tx_hash: e.txHash ?? null,
      circle_transaction_id: e.circleTransactionId ?? null,
      status: e.status ?? "confirmed",
      idempotency_key: e.idempotencyKey,
      notes: e.notes ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    // 23505 = unique violation on idempotency_key: the entry already exists.
    if ((error as any).code === "23505") {
      const { data: existing } = await admin
        .from("ledger_entries")
        .select("*")
        .eq("idempotency_key", e.idempotencyKey)
        .maybeSingle();
      return existing;
    }
    throw error;
  }
  return data;
}

export async function updateLedgerStatus(
  admin: any,
  idempotencyKey: string,
  patch: { status?: "pending" | "confirmed" | "failed"; txHash?: string | null; notes?: string | null },
) {
  await admin
    .from("ledger_entries")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.txHash !== undefined ? { tx_hash: patch.txHash } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    })
    .eq("idempotency_key", idempotencyKey);
}
