// USDC on Arc - update address when official deployment is known
export const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // placeholder
export const USDC_DECIMALS = 6;
export const ARC_CHAIN_ID = 0xa4b1;

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

export function encodeTransfer(to: string, amount: bigint): string {
  // function selector for transfer(address,uint256) = 0xa9059cbb
  const selector = "a9059cbb";
  const addr = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const amt = amount.toString(16).padStart(64, "0");
  return "0x" + selector + addr + amt;
}

export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}
