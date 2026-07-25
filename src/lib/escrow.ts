// Marketplace escrow treasury address on Arc Testnet.
// Buyers send USDC here when funding an escrow; the marketplace releases
// funds to the seller (or refunds the buyer) after resolution.
// TODO: swap for a Circle-managed contract wallet in Session 4.
export const ESCROW_TREASURY: `0x${string}` =
  "0x000000000000000000000000000000000000dEaD";

export type EscrowStatus =
  | "created"
  | "funded"
  | "released"
  | "refunded"
  | "disputed"
  | "cancelled";

export const ESCROW_STATUS_LABEL: Record<EscrowStatus, string> = {
  created: "Awaiting payment",
  funded: "Held in escrow",
  released: "Released to seller",
  refunded: "Refunded to buyer",
  disputed: "Under dispute",
  cancelled: "Cancelled",
};
