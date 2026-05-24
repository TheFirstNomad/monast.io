export type SupportedChainId = 8453 | 5042002;

export const CHAINS: Record<SupportedChainId, {
  name: string;
  shortName: string;
  explorer: string;
  isTestnet: boolean;
  faucetUrl?: string;
  dexName: string;
}> = {
  8453: {
    name: "Base Mainnet",
    shortName: "Base",
    explorer: "https://basescan.org",
    isTestnet: false,
    dexName: "Uniswap V3",
  },
  5042002: {
    name: "Arc Testnet",
    shortName: "Arc Testnet",
    explorer: "https://testnet.arcscan.app",
    isTestnet: true,
    faucetUrl: "https://faucet.circle.com",
    dexName: "Circle App Kit",
  },
};
