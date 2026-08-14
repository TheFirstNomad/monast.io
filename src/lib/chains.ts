/**
 * Chain registry - single source of truth for supported networks.
 * monast.io is Arc-native: Arc Testnet is the only live network, and Arc
 * Mainnet ships disabled until its launch (and until its USDC contract is
 * published - a zero address here must never be selectable).
 */
export type ChainKey = "arc-testnet" | "arc-mainnet";

export interface ChainEntry {
  id: number;
  key: ChainKey;
  label: string;
  network: string;
  rpc: string;
  usdc: `0x${string}`;
  explorer: string;
  enabled: boolean;
  appKitChain?: string;
}

export const CHAINS: Record<ChainKey, ChainEntry> = {
  "arc-testnet": {
    id: 5042002,
    key: "arc-testnet",
    label: "Arc Testnet",
    network: "arc-testnet",
    rpc: "https://rpc.testnet.arc.network",
    usdc: "0x3600000000000000000000000000000000000000",
    explorer: "https://testnet.arcscan.app",
    enabled: true,
    appKitChain: "Arc_Testnet",
  },
  "arc-mainnet": {
    id: 5042001,
    key: "arc-mainnet",
    label: "Arc Mainnet",
    network: "arc",
    rpc: "https://rpc.arc.network",
    usdc: "0x0000000000000000000000000000000000000000", // unpublished
    explorer: "https://arcscan.app",
    enabled: false,
    appKitChain: "Arc",
  },
};

export const ENABLED_CHAINS = Object.values(CHAINS).filter((c) => c.enabled);
export const ARC_CHAIN_IDS = Object.values(CHAINS).map((c) => c.id);
export const isArcChainId = (id: number) => ARC_CHAIN_IDS.includes(id);
export const isArcMainnetLive = () => CHAINS["arc-mainnet"].enabled;
