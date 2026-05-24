/**
 * Chain registry — single source of truth for supported networks.
 * monast.io supports Base, Arc Testnet, Ethereum Sepolia, Tempo Mainnet,
 * and Tempo Moderato Testnet. Arc Mainnet ships disabled.
 */
export type ChainKey =
  | "base"
  | "arc-testnet"
  | "arc-mainnet"
  | "sepolia"
  | "tempo-mainnet"
  | "tempo-moderato";

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

const ARC_MAINNET_PLACEHOLDER: ChainEntry = {
  id: 5042001,
  key: "arc-mainnet",
  label: "Arc Mainnet",
  network: "arc",
  rpc: "https://rpc.arc.network",
  usdc: "0x0000000000000000000000000000000000000000",
  explorer: "https://arcscan.app",
  enabled: false,
  appKitChain: "Arc",
};

export const CHAINS: Record<ChainKey, ChainEntry> = {
  base: {
    id: 8453, key: "base", label: "Base Mainnet", network: "base",
    rpc: "https://mainnet.base.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
    enabled: true,
    appKitChain: "Base",
  },
  "arc-testnet": {
    id: 5042002, key: "arc-testnet", label: "Arc Testnet", network: "arc-testnet",
    rpc: "https://rpc.testnet.arc.network",
    usdc: "0x75faF114eafb1BDbe2F0316DF893fd58CE46AA4d",
    explorer: "https://testnet.arcscan.app",
    enabled: true,
    appKitChain: "Arc_Testnet",
  },
  "arc-mainnet": ARC_MAINNET_PLACEHOLDER,
  sepolia: {
    id: 11155111, key: "sepolia", label: "Ethereum Sepolia", network: "sepolia",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    explorer: "https://sepolia.etherscan.io",
    enabled: true,
  },
  // Tempo — USDC-native gas, like Arc. USDC contract TBD: replace 0x000... once Tempo publishes it.
  "tempo-mainnet": {
    id: 4217, key: "tempo-mainnet", label: "Tempo Mainnet", network: "tempo",
    rpc: "https://rpc.tempo.xyz",
    usdc: "0x0000000000000000000000000000000000000000", // TODO: confirm
    explorer: "https://explorer.tempo.xyz", // TODO: confirm
    enabled: true,
  },
  "tempo-moderato": {
    id: 42431, key: "tempo-moderato", label: "Tempo Moderato Testnet", network: "tempo-moderato",
    rpc: "https://rpc.moderato.tempo.xyz",
    usdc: "0x0000000000000000000000000000000000000000", // TODO: confirm
    explorer: "https://explorer.moderato.tempo.xyz", // TODO: confirm
    enabled: true,
  },
};

export const ENABLED_CHAINS = Object.values(CHAINS).filter((c) => c.enabled);
export const isArcMainnetLive = () => CHAINS["arc-mainnet"].enabled;
