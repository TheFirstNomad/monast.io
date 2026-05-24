import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { base, sepolia } from "@reown/appkit/networks";
import { type ReactNode } from "react";

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "3592c16759a9b6907bc4eb5afd455b15";

// Arc Testnet — USDC is native gas (18 dec for msg.value)
const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
} as any;

// Tempo Mainnet — USDC native gas (placeholder until Tempo finalizes USDC contract)
const tempoMainnet = {
  id: 4217,
  name: "Tempo Mainnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.tempo.xyz"] } },
  blockExplorers: { default: { name: "Tempo Explorer", url: "https://explorer.tempo.xyz" } },
  testnet: false,
} as any;

// Tempo Moderato Testnet
const tempoModerato = {
  id: 42431,
  name: "Tempo Moderato Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.moderato.tempo.xyz"] } },
  blockExplorers: { default: { name: "Tempo Moderato Explorer", url: "https://explorer.moderato.tempo.xyz" } },
  testnet: true,
} as any;

const networks = [base, arcTestnet, sepolia, tempoMainnet, tempoModerato] as const;

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: networks as any,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: networks as any,
  projectId,
  metadata: {
    name: "monast.io",
    description: "Buy & sell anything worldwide with USDC. Trustless escrow marketplace.",
    url: typeof window !== "undefined" ? window.location.origin : "https://monast.io",
    icons: [],
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "hsl(210, 79%, 55%)",
    "--w3m-border-radius-master": "2px",
  },
  features: {
    email: false,
    socials: false,
    swaps: false,
    send: false,
    receive: false,
    onramp: false,
    history: false,
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
