/** Circle requires walletId OR walletAddress + blockchain, never both. */
export function contractExecutionBody(request: { id: string; wallet_id: string; contract_address: string; call_data: string }) {
  return {
    idempotencyKey: request.id,
    walletId: request.wallet_id,
    contractAddress: request.contract_address,
    callData: request.call_data,
    feeLevel: "MEDIUM",
    refId: request.id,
  };
}

export function correlatedTransactionId(request: { transaction_id?: string | null }, challenge: { correlationIds?: string[] }) {
  return request.transaction_id ?? challenge.correlationIds?.[0];
}