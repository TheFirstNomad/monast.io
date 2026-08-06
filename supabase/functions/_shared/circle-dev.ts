// Circle developer-controlled wallets — treasury side.
//
// Developer-controlled wallets are signed by Circle on the backend's behalf.
// Every mutating call needs a fresh `entitySecretCiphertext`: the 32-byte entity
// secret, RSA-OAEP(SHA-256) encrypted with Circle's entity public key, base64.
// The entity secret itself never leaves the edge function environment.

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
    8453: "BASE",
    84532: "BASE-SEPOLIA",
    11155111: "ETH-SEPOLIA",
    421614: "ARB-SEPOLIA",
  };
  const b = map[chainId];
  if (!b) throw new Error(`No Circle blockchain mapping for chain ${chainId}`);
  return b;
}

/** USDC token contract per chain, lowercase. Mirrors _shared/tx-verify.ts. */
export const USDC_ADDRESS: Record<number, string> = {
  5042002: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d",
  8453: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  84532: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
  11155111: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  421614: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d",
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
  amountUsdc: number;
  chainId: number;
  /** Stable key so a retried payout cannot double-send. */
  idempotencyKey: string;
}

export async function treasuryTransfer(args: TreasuryTransferArgs) {
  const body = await circleFetch("/developer/transactions/transfer", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: args.idempotencyKey,
      entitySecretCiphertext: await entitySecretCiphertext(),
      walletId: args.walletId,
      destinationAddress: args.destinationAddress,
      tokenAddress: usdcAddress(args.chainId),
      blockchain: circleBlockchain(args.chainId),
      amounts: [args.amountUsdc.toString()],
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
