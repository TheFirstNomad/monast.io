/**
 * Chain registry - single source of truth for supported networks.
 * monast.io is Arc-native. Arc Public Mainnet launches 16 September 2026 and
 * stays disabled here until its USDC contract is published: set
 * VITE_ARC_MAINNET_USDC (and optionally VITE_ARC_MAINNET_RPC) to switch the
 * marketplace over. A zero address must never be selectable.
 */
const MAINNET_USDC = (import.meta.env.VITE_ARC_MAINNET_USDC ?? "") as string;
const MAINNET_RPC = (import.meta.env.VITE_ARC_MAINNET_RPC ?? "https://rpc.arc.network") as string;
const MAINNET_READY =
  /^0x[0-9a-fA-F]{40}$/.test(MAINNET_USDC) && !/^0x0+$/.test(MAINNET_USDC);
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
    rpc: MAINNET_RPC,
    usdc: (MAINNET_READY
      ? MAINNET_USDC.toLowerCase()
      : "0x0000000000000000000000000000000000000000") as `0x${string}`,
    explorer: "https://arcscan.app",
    enabled: MAINNET_READY,
    appKitChain: "Arc",
  },
};

/** The chain the marketplace trades on today: mainnet once it is configured. */
export const ACTIVE_CHAIN: ChainEntry = CHAINS["arc-mainnet"].enabled
  ? CHAINS["arc-mainnet"]
  : CHAINS["arc-testnet"];

export const ENABLED_CHAINS = Object.values(CHAINS).filter((c) => c.enabled);
export const ARC_CHAIN_IDS = Object.values(CHAINS).map((c) => c.id);
export const isArcChainId = (id: number) => ARC_CHAIN_IDS.includes(id);
export const isArcMainnetLive = () => CHAINS["arc-mainnet"].enabled;
