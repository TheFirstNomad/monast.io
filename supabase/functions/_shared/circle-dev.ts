// Circle developer-controlled wallets — treasury side.
//
// Developer-controlled wallets are signed by Circle on the backend's behalf.
// Every mutating call needs a fresh `entitySecretCiphertext`: the 32-byte entity
// secret, RSA-OAEP(SHA-256) encrypted with Circle's entity public key, base64.
// The entity secret itself never leaves the edge function environment.

import { formatUsdc, toBaseUnits } from "./fees.ts";

const CIRCLE_BASE = "https://api.circle.com/v1/w3s";

function apiKey(): string {
  const k = Deno.env.get("CIRCLE_API_KEY");
  if (!k) throw new Error("CIRCLE_API_KEY is not configured");
  return k;
}

function entitySecretHex(): string {
  const s = Deno.env.get("CIRCLE_ENTITY_SECRET");
  if (!s) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET is not configured — treasury operations are disabled",
    );
  }
  const hex = s.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("CIRCLE_ENTITY_SECRET must be a 32-byte hex string (64 hex chars)");
  }
  return hex;
}

export async function circleFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CIRCLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Circle ${path} ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i);
  return der;
}

let cachedPublicKey: string | null = null;

async function entityPublicKeyPem(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const res = await circleFetch("/config/entity/publicKey", { method: "GET" });
  const pem = res?.data?.publicKey;
  if (!pem) throw new Error("Circle did not return an entity public key");
  cachedPublicKey = pem;
  return pem;
}

/** Fresh ciphertext for one Circle call. Never reuse across requests. */
export async function entitySecretCiphertext(): Promise<string> {
  const pem = await entityPublicKeyPem();
  const key = await crypto.subtle.importKey(
    "spki",
    pemToDer(pem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    key,
    hexToBytes(entitySecretHex()),
  );
  let binary = "";
  const bytes = new Uint8Array(encrypted);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * EVM chain id -> Circle blockchain identifier.
 * Arc's Circle identifier can be overridden with CIRCLE_ARC_TESTNET_BLOCKCHAIN
 * so a rename on Circle's side needs no redeploy.
 */
export function circleBlockchain(chainId: number): string {
  const arcTestnet = Deno.env.get("CIRCLE_ARC_TESTNET_BLOCKCHAIN") ?? "ARC-TESTNET";
  const arcMainnet = Deno.env.get("CIRCLE_ARC_MAINNET_BLOCKCHAIN") ?? "ARC";
  const map: Record<number, string> = {
    5042002: arcTestnet,
    5042001: arcMainnet,
  };
  const b = map[chainId];
  if (!b) throw new Error(`No Circle blockchain mapping for chain ${chainId}`);
  return b;
}

/** USDC token contract per chain, lowercase.
 *  Source of truth: src/lib/chains.ts (frontend) and _shared/tx-verify.ts
 *  (deposit verification). These three MUST stay identical — this map is the
 *  address Circle uses to move real funds on release, refund and fee sweeps. */
export const USDC_ADDRESS: Record<number, string> = {
  5042002: "0x3600000000000000000000000000000000000000",
};

export function usdcAddress(chainId: number): string {
  const a = USDC_ADDRESS[chainId];
  if (!a || /^0x0+$/.test(a)) {
    throw new Error(`No USDC contract configured for chain ${chainId}`);
  }
  return a;
}

export async function createWalletSet(name: string) {
  const body = await circleFetch("/developer/walletSets", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: await entitySecretCiphertext(),
      name,
    }),
  });
  return body.data.walletSet;
}

export async function createWallets(
  walletSetId: string,
  blockchains: string[],
  count = 1,
  accountType: "SCA" | "EOA" = "SCA",
) {
  const body = await circleFetch("/developer/wallets", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: await entitySecretCiphertext(),
      walletSetId,
      blockchains,
      count,
      accountType,
    }),
  });
  return body.data.wallets as Array<{ id: string; address: string; blockchain: string }>;
}

export interface TreasuryTransferArgs {
  walletId: string;
  destinationAddress: string;
  /** Number or exact decimal string. Strings are preferred: they come straight
   *  from integer micro-USDC math and cannot carry float error. */
  amountUsdc: number | string;
  chainId: number;
  /** Stable key so a retried payout cannot double-send. Any string is accepted:
   *  Circle requires a UUID, so non-UUID keys are hashed into a deterministic
   *  UUID below (same input -> same UUID -> Circle still dedupes retries). */
  idempotencyKey: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Deterministic v4-shaped UUID derived from a stable string. */
export async function stableUuid(seed: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)),
  );
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function circleIdempotencyKey(key: string): Promise<string> {
  return UUID_RE.test(key) ? key : await stableUuid(key);
}

export async function treasuryTransfer(args: TreasuryTransferArgs) {
  const body = await circleFetch("/developer/transactions/transfer", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: await circleIdempotencyKey(args.idempotencyKey),
      entitySecretCiphertext: await entitySecretCiphertext(),
      walletId: args.walletId,
      destinationAddress: args.destinationAddress,
      tokenAddress: usdcAddress(args.chainId),
      blockchain: circleBlockchain(args.chainId),
      amounts: [
        typeof args.amountUsdc === "string"
          ? args.amountUsdc
          : formatUsdc(toBaseUnits(args.amountUsdc)),
      ],
      feeLevel: "MEDIUM",
    }),
  });
  return body.data as { id: string; state?: string };
}

export async function getTransaction(id: string) {
  const body = await circleFetch(`/transactions/${id}`, { method: "GET" });
  return body.data.transaction as {
    id: string;
    state: string;
    txHash?: string;
    errorReason?: string;
  };
}

export async function walletBalance(walletId: string) {
  const body = await circleFetch(`/wallets/${walletId}/balances`, { method: "GET" });
  return body.data.tokenBalances as Array<{ amount: string; token: { symbol: string } }>;
}
