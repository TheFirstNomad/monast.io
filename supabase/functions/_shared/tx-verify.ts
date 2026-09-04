// Verifies an on-chain USDC ERC-20 transfer via raw JSON-RPC.
// Confirms the tx exists, was successful, emitted a USDC Transfer event
// to `expectedTo` for at least `expectedAmountUsdc` (6 decimals),
// and (when provided) came from `expectedFrom`.

import { toBaseUnits } from "./fees.ts";
import {
  ARC_MAINNET_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID,
  arcRpc,
  arcUsdcAddress,
  isArcMainnetLive,
} from "./arc-chains.ts";


interface ChainConf {
  rpc: string;
  usdc: string; // lowercase
}

// monast.io is Arc-native. Only Arc chains are accepted here, so a payment
// claimed on any other network is rejected rather than silently trusted.
// Arc Public Mainnet becomes verifiable the moment its USDC contract is
// configured (ARC_MAINNET_USDC_ADDRESS) - never before.
function chainConf(chainId: number): ChainConf | null {
  if (chainId === ARC_TESTNET_CHAIN_ID) {
    return { rpc: arcRpc(chainId), usdc: arcUsdcAddress(chainId).toLowerCase() };
  }
  if (chainId === ARC_MAINNET_CHAIN_ID && isArcMainnetLive()) {
    return { rpc: arcRpc(chainId), usdc: arcUsdcAddress(chainId).toLowerCase() };
  }
  return null;
}



// Arc has no reorg history yet, so funding is held to a conservative
// confirmation depth rather than trusting the first successful receipt.
// Tunable per network once Arc's finality profile is better understood.
const MIN_CONFIRMATIONS: Record<number, number> = {
  5042002: 3, // Arc Testnet
  5042001: 3, // Arc Mainnet
};

const DEFAULT_MIN_CONFIRMATIONS = 12;

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
  /** True when the transfer looks valid but is not deep enough yet. The caller
   *  should ask the user to wait rather than treating this as a failure. */
  pending?: boolean;
  confirmations?: number;
  requiredConfirmations?: number;
  from?: string;
  to?: string;
  amountUsdc?: number;
}

export async function verifyUsdcTransfer(args: VerifyArgs): Promise<VerifyResult> {
  const chain = chainConf(args.chainId);
  if (!chain) return { ok: false, error: `unsupported chain ${args.chainId}` };
  if (!/^0x[0-9a-f]{64}$/i.test(args.txHash)) return { ok: false, error: "invalid tx_hash" };

  let receipt: any;
  try {
    receipt = await rpc(chain.rpc, "eth_getTransactionReceipt", [args.txHash]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!receipt) {
    return { ok: false, pending: true, error: "transaction not found or not yet mined" };
  }
  if (receipt.status !== "0x1") return { ok: false, error: "transaction failed on-chain" };

  // Confirmation depth: a receipt only proves the tx was included in *a* block.
  const required = MIN_CONFIRMATIONS[args.chainId] ?? DEFAULT_MIN_CONFIRMATIONS;
  let confirmations = 0;
  try {
    const head = BigInt(await rpc(chain.rpc, "eth_blockNumber", []));
    const mined = BigInt(receipt.blockNumber);
    confirmations = head >= mined ? Number(head - mined) + 1 : 0;
  } catch (e) {
    return { ok: false, error: `could not read chain head: ${(e as Error).message}` };
  }
  if (confirmations < required) {
    return {
      ok: false,
      pending: true,
      confirmations,
      requiredConfirmations: required,
      error: `waiting for confirmations (${confirmations}/${required})`,
    };
  }

  const expectedToLower = args.expectedTo.toLowerCase();
  const expectedFromLower = args.expectedFrom?.toLowerCase();
  const expectedRaw = toBaseUnits(args.expectedAmountUsdc);

  for (const log of receipt.logs ?? []) {
    if (!toChecksumEq(log.address, chain.usdc)) continue;
    if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) continue;
    const from = topicToAddress(log.topics[1]);
    const to = topicToAddress(log.topics[2]);
    if (to !== expectedToLower) continue;
    if (expectedFromLower && from !== expectedFromLower) continue;
    const value = BigInt(log.data);
    if (value < expectedRaw) continue;
    return {
      ok: true,
      from,
      to,
      amountUsdc: Number(value) / 10 ** USDC_DECIMALS,
      confirmations,
      requiredConfirmations: required,
    };
  }

  return { ok: false, error: "no matching USDC Transfer found in transaction logs" };
}
