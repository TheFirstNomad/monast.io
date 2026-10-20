export const ESCROW_CONTRACT = "0xca19df99563fe93c6172463e4b66a3dcf2cf1eba" as const;
export const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
export const CONTRACT_CHAIN_ID = 5042;

export function authorizeContractAction(operation: string, escrow: {
  buyer_id: string; seller_id: string; settlement: string; status: string;
}, userId: string) {
  if (escrow.settlement !== "contract") throw new Error("This older escrow must finish through its original payment path.");
  const buyer = escrow.buyer_id === userId;
  const seller = escrow.seller_id === userId;
  if (!buyer && !seller) throw new Error("Not your escrow");
  if (operation === "confirmDelivery" && !buyer) throw new Error("Only the buyer can confirm delivery.");
  if (["refundBuyer", "markReadyForRelease", "claimAutoRelease"].includes(operation) && !seller) throw new Error("Only the seller can do this.");
  if (!["funded", "disputed"].includes(escrow.status)) throw new Error("This escrow is not awaiting that action.");
  if (["openDispute", "markReadyForRelease", "claimAutoRelease"].includes(operation) && escrow.status !== "funded") throw new Error("This action requires a funded, undisputed escrow.");
  if (!["confirmDelivery", "refundBuyer", "markReadyForRelease", "claimAutoRelease", "openDispute"].includes(operation)) throw new Error("Unsupported contract action");
}

export function exactApproval(amount: bigint, phase: string) {
  if (phase !== "approve" || amount <= 0n) throw new Error("No USDC approval is required for this action.");
  return { target: ARC_USDC, spender: ESCROW_CONTRACT, amount };
}