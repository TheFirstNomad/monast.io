// USDC defaults for the active marketplace chain.
// Sourced from the central chain registry so we never drift from chains.ts.
import { CHAINS } from "./chains";

// Default trading chain - Arc Testnet while Arc Mainnet is unreleased.
const DEFAULT = CHAINS["arc-testnet"];

export const USDC_ADDRESS: `0x${string}` = DEFAULT.usdc;
export const USDC_DECIMALS = 6;
export const ARC_CHAIN_ID: number = DEFAULT.id;

export const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Helper kept for any legacy call-sites; wagmi `useWriteContract` is preferred.
export function encodeTransfer(to: string, amount: bigint): string {
  const selector = "a9059cbb";
  const addr = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const amt = amount.toString(16).padStart(64, "0");
  return "0x" + selector + addr + amt;
}

export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}
