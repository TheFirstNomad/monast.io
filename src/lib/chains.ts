/**
 * Chain registry - single source of truth for supported networks.
 * monast.io is Arc-native. Arc Public Mainnet is chain 5042 with USDC at
 * 0x3600...0000 and explorer https://explorer.arc.io. Every value can be
 * overridden through build config (VITE_ARC_*) without touching code.
 * A zero address must never be selectable.
 */
const MAINNET_USDC = (import.meta.env.VITE_ARC_MAINNET_USDC ??
  "0x3600000000000000000000000000000000000000") as string;
const MAINNET_RPC = (import.meta.env.VITE_ARC_MAINNET_RPC ??
  "https://rpc.mainnet.arc.io") as string;
const MAINNET_EXPLORER = (import.meta.env.VITE_ARC_MAINNET_EXPLORER ??
  "https://explorer.arc.io") as string;
const MAINNET_CHAIN_ID = Number(import.meta.env.VITE_ARC_CHAIN_ID ?? 5042);
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

export const ARC_MAINNET_ID = MAINNET_CHAIN_ID;
export const ARC_TESTNET_ID = 5042002;

export const CHAINS: Record<ChainKey, ChainEntry> = {
  "arc-testnet": {
    id: ARC_TESTNET_ID,
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
    id: MAINNET_CHAIN_ID,
    key: "arc-mainnet",
    label: "Arc Mainnet",
    network: "arc",
    rpc: MAINNET_RPC,
    usdc: (MAINNET_READY
      ? MAINNET_USDC.toLowerCase()
      : "0x0000000000000000000000000000000000000000") as `0x${string}`,
    explorer: MAINNET_EXPLORER,
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

/** Human label for a chain id, so records always show their own network. */
export const chainLabel = (chainId: number) =>
  chainId === MAINNET_CHAIN_ID ? CHAINS["arc-mainnet"].label : CHAINS["arc-testnet"].label;

/** Explorer transaction URL for any supported Arc chain. */
export const explorerTxUrl = (chainId: number, txHash: string) =>
  `${chainId === MAINNET_CHAIN_ID ? MAINNET_EXPLORER : CHAINS["arc-testnet"].explorer}/tx/${txHash}`;
