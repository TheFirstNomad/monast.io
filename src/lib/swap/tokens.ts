export interface TokenInfo {
  symbol: string;
  name: string;
  address: `0x${string}` | "native";
  decimals: number;
  logoUrl: string;
  isStable?: boolean;
}

export const BASE_TOKENS: TokenInfo[] = [
  { symbol: "ETH", name: "Ethereum", address: "native", decimals: 18, logoUrl: "/tokens/eth.png" },
  { symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, logoUrl: "/tokens/usdc.png", isStable: true },
  { symbol: "WETH", name: "Wrapped Ether", address: "0x4200000000000000000000000000000000000006", decimals: 18, logoUrl: "/tokens/weth.png" },
  { symbol: "DAI", name: "Dai Stablecoin", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18, logoUrl: "/tokens/dai.png", isStable: true },
  { symbol: "cbBTC", name: "Coinbase BTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8, logoUrl: "/tokens/btc.png" },
  { symbol: "USDbC", name: "USD Base Coin", address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6Cb", decimals: 6, logoUrl: "/tokens/usdbc.png", isStable: true },
  { symbol: "AERO", name: "Aerodrome", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", decimals: 18, logoUrl: "/tokens/eth.png" },
  { symbol: "DEGEN", name: "Degen", address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", decimals: 18, logoUrl: "/tokens/eth.png" },
];

export const ARC_TESTNET_TOKENS: TokenInfo[] = [
  { symbol: "USDC", name: "USDC (Native)", address: "0x3600000000000000000000000000000000000000", decimals: 6, logoUrl: "/tokens/usdc.png", isStable: true },
  { symbol: "EURC", name: "Euro Coin", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6, logoUrl: "/tokens/eurc.png", isStable: true },
];

export const TOKENS_BY_CHAIN: Record<number, TokenInfo[]> = {
  8453: BASE_TOKENS,
  5042002: ARC_TESTNET_TOKENS,
};

export const WETH_ADDRESS: `0x${string}` = "0x4200000000000000000000000000000000000006";
export const ARC_WRAPPED_NATIVE: `0x${string}` = "0x3600000000000000000000000000000000000000";

export const PLATFORM_FEE_BPS = 0;
export const PLATFORM_FEE_WALLET: `0x${string}` = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c";

export const POOL_FEES: Record<string, number> = {
  "ETH-USDC": 500, "USDC-ETH": 500,
  "WETH-USDC": 500, "USDC-WETH": 500,
  "DAI-USDC": 100, "USDC-DAI": 100,
  "cbBTC-WETH": 3000, "WETH-cbBTC": 3000,
  "cbBTC-USDC": 3000, "USDC-cbBTC": 3000,
  "USDbC-USDC": 100, "USDC-USDbC": 100,
};

export const DEFAULT_POOL_FEE = 3000;

export function getPoolFee(a: string, b: string): number {
  return POOL_FEES[`${a}-${b}`] ?? DEFAULT_POOL_FEE;
}

export function searchTokens(tokens: TokenInfo[], query: string): TokenInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return tokens;
  return tokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.address !== "native" && t.address.toLowerCase().includes(q))
  );
}

export const POPULAR_PAIRS: Record<number, { from: string; to: string }[]> = {
  8453: [
    { from: "ETH", to: "USDC" },
    { from: "cbBTC", to: "USDC" },
    { from: "DAI", to: "USDC" },
    { from: "WETH", to: "USDC" },
  ],
  5042002: [
    { from: "USDC", to: "EURC" },
    { from: "EURC", to: "USDC" },
  ],
};

export function getRouteDisplay(tokenIn: TokenInfo, tokenOut: TokenInfo, chainId?: number): string {
  if (chainId === 5042002) return `${tokenIn.symbol} → ${tokenOut.symbol}`;
  const isNativeIn = tokenIn.address === "native" && tokenIn.symbol === "ETH";
  if (isNativeIn) return `ETH → WETH → ${tokenOut.symbol}`;
  const isNativeOut = tokenOut.address === "native" && tokenOut.symbol === "ETH";
  if (isNativeOut) return `${tokenIn.symbol} → WETH → ETH`;
  return `${tokenIn.symbol} → ${tokenOut.symbol}`;
}
