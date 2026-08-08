/**
 * Tokens that Circle App Kit can swap on Arc.
 * Arc Testnet is a swap-supported chain in @circle-fin/app-kit (SwapChain.Arc_Testnet)
 * and exposes USDC (the native gas token) and EURC.
 */
import type { PaymentChainId } from "./arcAppKit";

export interface SwapToken {
  symbol: string;
  name: string;
  /** undefined = native gas token */
  address?: `0x${string}`;
  decimals: number;
  icon: string;
}

export const ARC_TESTNET_TOKENS: SwapToken[] = [
  { symbol: "USDC", name: "USD Coin", decimals: 18, icon: "$" },
  {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    icon: "€",
  },
];

export function tokensForChain(_chainId: PaymentChainId): SwapToken[] {
  // Arc Mainnet token list lands with mainnet launch; testnet list is used today.
  return ARC_TESTNET_TOKENS;
}

export function findToken(symbol: string): SwapToken | undefined {
  return ARC_TESTNET_TOKENS.find((t) => t.symbol === symbol);
}
