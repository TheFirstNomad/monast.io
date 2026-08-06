// The escrow deposit address is never hardcoded. It lives in the backend
// `treasury_wallets` table and is fetched at runtime via `useTreasuryAddress`,
// so a misconfigured deployment surfaces an error instead of quietly sending
// buyer funds to a placeholder address.

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
