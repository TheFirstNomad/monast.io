// Verifies an on-chain USDC ERC-20 transfer via raw JSON-RPC.
// Confirms the tx exists, was successful, emitted a USDC Transfer event
// to `expectedTo` for at least `expectedAmountUsdc` (6 decimals),
// and (when provided) came from `expectedFrom`.

interface ChainConf {
  rpc: string;
  usdc: string; // lowercase
}

const CHAINS: Record<number, ChainConf> = {
  5042002: { rpc: "https://rpc.testnet.arc.network",       usdc: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d" },
  8453:    { rpc: "https://mainnet.base.org",              usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" },
  84532:   { rpc: "https://sepolia.base.org",              usdc: "0x036cbd53842c5426634e7929541ec2318f3dcf7e" },
  421614:  { rpc: "https://sepolia-rollup.arbitrum.io/rpc", usdc: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d" },
  11155111:{ rpc: "https://ethereum-sepolia-rpc.publicnode.com", usdc: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" },
};


const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDC_DECIMALS = 6;

function toChecksumEq(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function topicToAddress(topic: string): string {
  // last 20 bytes of a 32-byte topic
  return "0x" + topic.slice(26).toLowerCase();
}

async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${method} http ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`);
  return j.result;
}

export interface VerifyArgs {
  chainId: number;
  txHash: string;
  expectedTo: string;
  expectedAmountUsdc: number;
  expectedFrom?: string;
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  from?: string;
  to?: string;
  amountUsdc?: number;
}

export async function verifyUsdcTransfer(args: VerifyArgs): Promise<VerifyResult> {
  const chain = CHAINS[args.chainId];
  if (!chain) return { ok: false, error: `unsupported chain ${args.chainId}` };
  if (!/^0x[0-9a-f]{64}$/i.test(args.txHash)) return { ok: false, error: "invalid tx_hash" };

  let receipt: any;
  try {
    receipt = await rpc(chain.rpc, "eth_getTransactionReceipt", [args.txHash]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!receipt) return { ok: false, error: "transaction not found or not yet mined" };
  if (receipt.status !== "0x1") return { ok: false, error: "transaction failed on-chain" };

  const expectedToLower = args.expectedTo.toLowerCase();
  const expectedFromLower = args.expectedFrom?.toLowerCase();
  const expectedRaw = BigInt(Math.round(args.expectedAmountUsdc * 10 ** USDC_DECIMALS));

  for (const log of receipt.logs ?? []) {
    if (!toChecksumEq(log.address, chain.usdc)) continue;
    if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) continue;
    const from = topicToAddress(log.topics[1]);
    const to = topicToAddress(log.topics[2]);
    if (to !== expectedToLower) continue;
    if (expectedFromLower && from !== expectedFromLower) continue;
    const value = BigInt(log.data);
    if (value < expectedRaw) continue;
    return { ok: true, from, to, amountUsdc: Number(value) / 10 ** USDC_DECIMALS };
  }

  return { ok: false, error: "no matching USDC Transfer found in transaction logs" };
}
