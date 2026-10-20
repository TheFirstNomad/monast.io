// MonastEscrowV3 on Arc Mainnet. New escrows for self-custody wallets settle
// here: the contract holds the USDC and pays the seller (minus the fee, which it
// sends to the Monast treasury) on confirmDelivery. Monast's servers never move
// these funds; they only read the receipts and mirror the result.
import abiJson from "./monastEscrowAbi.json";
import { ARC_MAINNET_ID } from "./chains";

export const MONAST_ESCROW_ADDRESS = "0xcA19dF99563fe93c6172463E4B66a3DCF2cf1eBA" as const;
export const MONAST_ESCROW_CHAIN_ID = ARC_MAINNET_ID;
export const MONAST_ESCROW_ABI = abiJson as any;

export const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Turns contract revert names into plain sentences. */
export function contractErrorMessage(e: any): string {
  const name: string | undefined =
    e?.cause?.data?.errorName ?? e?.data?.errorName ?? e?.cause?.cause?.data?.errorName;
  const map: Record<string, string> = {
    EnforcedPause: "Escrow is paused for maintenance. Try again shortly.",
    ListingNotActive: "This listing is no longer available on-chain.",
    ListingNoSlotsAvailable: "This listing is already sold out.",
    NotEscrowBuyer: "Only the buyer can do this.",
    NotEscrowSeller: "Only the seller can do this.",
    InvalidEscrowState: "This escrow is not in the right state for that action.",
    AutoReleaseNotReady: "The automatic release window has not passed yet.",
    NothingToWithdraw: "There is nothing to withdraw yet.",
    InvalidPrice: "The price is not valid.",
  };
  if (name && map[name]) return map[name];
  const msg = String(e?.shortMessage || e?.message || "");
  if (/allowance/i.test(msg)) return "USDC approval was too small. Please try again.";
  if (/rejected|denied/i.test(msg)) return "You cancelled the request in your wallet.";
  return msg || "The contract call failed";
}
