/**
 * Circle Arc App Kit integration — kit.send / kit.bridge / kit.swap.
 * All Circle API calls are routed through the circle-proxy Edge Function
 * to bypass CORS on custom domains.
 */

import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { supabase } from "@/integrations/supabase/client";

/**
 * The real Circle Kit Key is a server-side secret (ARC_KIT_KEY) held only by
 * the circle-proxy edge function, which injects it into every Circle API
 * request. The browser never sees it — App Kit is constructed with this
 * non-secret placeholder and all traffic is relayed through the proxy.
 */
export const ARC_KIT_KEY = "KIT_KEY:proxy";


// Treasury / admin wallet for monast.io
export const TREASURY_ADDRESS: `0x${string}` =
  "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c";

// Arc-native: Arc Testnet today, Arc Mainnet once it launches.
export type PaymentChainId = 5042002 | 5042001;

function chainString(chainId: PaymentChainId): string {
  return chainId === 5042001 ? "Arc" : "Arc_Testnet";
}

export function getChainLabel(chainId: PaymentChainId): string {
  return chainId === 5042001 ? "Arc Mainnet" : "Arc Testnet";
}

export function getExplorerUrl(chainId: PaymentChainId, txHash: string): string {
  return chainId === 5042001
    ? `https://arcscan.app/tx/${txHash}`
    : `https://testnet.arcscan.app/tx/${txHash}`;
}

export function getExplorerName(chainId: PaymentChainId): string {
  return "ArcScan";
}

function extractTxHash(result: unknown): string {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.txHash === "string" && r.txHash) return r.txHash;
    if (typeof r.transactionHash === "string" && r.transactionHash) return r.transactionHash;
  }
  return String(result);
}

export async function createViemAdapterFromWallet(passedProvider?: unknown) {
  const provider = (passedProvider as Record<string, unknown>) || (window as unknown as Record<string, unknown>).ethereum;

  if (!provider || typeof (provider as Record<string, unknown>).request !== "function") {
    throw new Error(
      "No valid EIP-1193 provider detected. Pass walletProvider from useAppKitProvider('eip155')."
    );
  }

  await (provider as { request: (args: { method: string }) => Promise<unknown> }).request({
    method: "eth_requestAccounts",
  });

  return await createViemAdapterFromProvider({
    provider,
    capabilities: { addressContext: "user-controlled" },
  } as Parameters<typeof createViemAdapterFromProvider>[0]);
}

let _kit: AppKit | null = null;
function getAppKit(): AppKit {
  if (!_kit) {
    _kit = new AppKit({ kitKey: ARC_KIT_KEY } as ConstructorParameters<typeof AppKit>[0]);
  }
  return _kit;
}

export async function payListingFee(
  adapter: Awaited<ReturnType<typeof createViemAdapterFromWallet>>,
  chainId: PaymentChainId = 5042002,
  amount: string = "10",
) {
  const kit = getAppKit();
  const chain = chainString(chainId);
  const result = await kit.send({
    from: { adapter, chain },
    to: TREASURY_ADDRESS,
    amount,
    token: "USDC",
  } as Parameters<typeof kit.send>[0]);
  const txHash = extractTxHash(result);
  return { txHash, explorerUrl: getExplorerUrl(chainId, txHash) };
}

// ── Circle API CORS proxy ───────────────────────────────────────────
const CIRCLE_API_ORIGIN = "https://api.circle.com";
const PROXY_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/circle-proxy`;

async function withCircleProxy<T>(fn: () => Promise<T>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Sign in required before swapping.");
  }
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.startsWith(CIRCLE_API_ORIGIN)) {
      const path = new URL(url).pathname + new URL(url).search;
      const method = init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? (input as Request).method : "GET");
      let body: unknown;
      if (init?.body) {
        try { body = JSON.parse(init.body as string); } catch { body = init.body; }
      }
      return originalFetch(PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ method, path, body }),
      });
    }
    return originalFetch(input, init);
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}


export async function swapViaKit(
  adapter: Awaited<ReturnType<typeof createViemAdapterFromWallet>>,
  chainId: PaymentChainId,
  tokenIn: string,
  tokenOut: string,
  amount: string,
) {
  const kit = getAppKit();
  const chain = chainString(chainId);
  const doSwap = () => kit.swap({
    from: { adapter, chain },
    tokenIn, tokenOut, amountIn: amount,
    config: { kitKey: ARC_KIT_KEY },
  } as Parameters<typeof kit.swap>[0]);
  const result = await withCircleProxy(doSwap);
  return { txHash: extractTxHash(result) };
}

export async function bridgeUsdc(
  adapter: Awaited<ReturnType<typeof createViemAdapterFromWallet>>,
  fromChain: string,
  toChain: string,
  amount: string,
) {
  const kit = getAppKit();
  const result = await kit.bridge({
    from: { adapter, chain: fromChain },
    to: { adapter, chain: toChain },
    amount,
    token: "USDC",
  } as Parameters<typeof kit.bridge>[0]);
  return { txHash: extractTxHash(result) };
}

export default getAppKit;
