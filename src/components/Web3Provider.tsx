import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { type ReactNode } from "react";
import { CHAINS } from "@/lib/chains";

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "3592c16759a9b6907bc4eb5afd455b15";

// monast.io is Arc-native — Arc Testnet is the only wallet network offered.
// USDC is the native gas token on Arc (18 decimals for msg.value).
const ARC = CHAINS["arc-testnet"];

const arcTestnet = {
  id: ARC.id,
  name: ARC.label,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC.rpc] } },
  blockExplorers: { default: { name: "ArcScan", url: ARC.explorer } },
  testnet: true,
} as any;

const networks = [arcTestnet] as const;

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: networks as any,
});

// Wallet list order shown in the connect modal (Reown wallet registry IDs).
const FEATURED_WALLETS = [
  // MetaMask
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  // OKX Wallet
  "971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709",
  // Trust Wallet
  "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
  // Coinbase / Base App wallet
  "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
  // Binance Wallet
  "8a0ee50d1f22f6651afcae7eb4253e52a3310b32df22797c96c4b39b1f2c8f7d",
];

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
  // Hide the generic "WalletConnect / QR CODE" row at the top of the list.
  enableWalletConnect: false,
  featuredWalletIds: FEATURED_WALLETS,
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
