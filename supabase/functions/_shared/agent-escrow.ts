// Escrow actions exposed to AI agents. These mirror the buyer-facing escrow
// edge functions (escrow-create / escrow-confirm-funded / escrow-release) but
// are driven by an agent API key instead of a user session, so the REST router
// and the MCP server can share exactly one implementation.
import { defaultArcChainId } from "./arc-chains.ts";
import { getTreasury, isTreasuryMissing } from "./treasury.ts";
import { verifyUsdcTransfer } from "./tx-verify.ts";
import { writeLedger } from "./ledger.ts";
import { notify } from "./notify.ts";
import { runPayout } from "./payout.ts";
import { loadFeeSettings } from "./fees.ts";

export interface AgentEscrowResult {
  status: number;
  body: unknown;
}

function ok(body: unknown): AgentEscrowResult {
  return { status: 200, body };
}
function fail(status: number, error: string, extra?: Record<string, unknown>): AgentEscrowResult {
  return { status, body: { error, ...(extra ?? {}) } };
}

/** Buyer-side wallet an agent pays from, used to bind deposit proofs. */
async function buyerWallets(svc: any, userId: string): Promise<string[]> {
  const { data } = await svc
    .from("profiles")
    .select("wallet_address, circle_wallet_address")
    .eq("id", userId)
    .maybeSingle();
  return [data?.wallet_address, data?.circle_wallet_address].filter(Boolean) as string[];
}

/** List every escrow the agent's user is party to, newest first. */
export async function listAgentEscrows(svc: any, userId: string): Promise<AgentEscrowResult> {
  const { data, error } = await svc
    .from("escrows")
    .select("*, ad:ads!escrows_ad_id_fkey(title, price_usdc, status)")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail(400, error.message);
  return ok({ escrows: data });
}

/**
 * Opens (or reuses) an escrow for an ad and returns the treasury address the
 * agent must send USDC to. Idempotent per (ad_id, buyer) while an escrow is
 * still live, so a retrying agent never creates duplicates.
 */
export async function createAgentEscrow(
  svc: any,
  args: { buyerId: string; adId: string; chainId?: number },
): Promise<AgentEscrowResult> {
  const adId = String(args.adId ?? "");
  if (!adId) return fail(400, "ad_id required");
  const chainId = Number.isFinite(args.chainId) && args.chainId ? Number(args.chainId) : defaultArcChainId();

  const { data: ad } = await svc
    .from("ads")
    .select("id, seller_id, price_usdc, status")
    .eq("id", adId)
    .maybeSingle();
  if (!ad) return fail(404, "ad_not_found");
  if (ad.seller_id === args.buyerId) return fail(400, "cannot buy your own listing");
  if (ad.status !== "active") return fail(409, `listing is ${ad.status}`);

  let treasury;
  try {
    treasury = await getTreasury(svc, "escrow", chainId);
  } catch (e) {
    if (isTreasuryMissing(e)) return fail(503, (e as Error).message, { configured: false });
    throw e;
  }

  const { data: acceptedOffer } = await svc
    .from("offers")
    .select("id, amount_usdc")
    .eq("ad_id", adId)
    .eq("buyer_id", args.buyerId)
    .eq("status", "accepted")
    .maybeSingle();
  const amount = Number(acceptedOffer?.amount_usdc ?? ad.price_usdc);

  const { data: existing } = await svc
    .from("escrows")
    .select("*")
    .eq("ad_id", adId)
    .eq("buyer_id", args.buyerId)
    .in("status", ["created", "funded", "disputed"])
    .maybeSingle();
  if (existing) {
    return ok({ escrow: existing, reused: true, deposit_address: treasury.address, chain_id: existing.chain_id });
  }

  const { data: inserted, error } = await svc
    .from("escrows")
    .insert({
      ad_id: adId,
      buyer_id: args.buyerId,
      seller_id: ad.seller_id,
      offer_id: acceptedOffer?.id ?? null,
      chain_id: chainId,
      amount_usdc: amount,
      status: "created",
    })
    .select("*")
    .single();
  if (error) return fail(400, error.message);

  return ok({ escrow: inserted, reused: false, deposit_address: treasury.address, chain_id: chainId });
}

/**
 * Confirms an agent's on-chain USDC deposit into the escrow treasury and flips
 * the escrow to `funded`. The transfer is verified on Arc first: amount,
 * destination, and sender must all match before any status changes.
 */
export async function fundAgentEscrow(
  svc: any,
  args: { escrowId: string; buyerId: string; agentWallet?: string; txHash: string },
): Promise<AgentEscrowResult> {
  const escrowId = String(args.escrowId ?? "");
  const txHash = String(args.txHash ?? "");
  if (!escrowId || !/^0x[0-9a-f]{64}$/i.test(txHash)) return fail(400, "escrow_id and a valid tx_hash required");

  const { data: esc } = await svc.from("escrows").select("*").eq("id", escrowId).maybeSingle();
  if (!esc) return fail(404, "escrow_not_found");
  if (esc.buyer_id !== args.buyerId) return fail(403, "not your escrow");
  if (esc.status !== "created") return fail(409, `escrow already ${esc.status}`);

  let treasury;
  try {
    treasury = await getTreasury(svc, "escrow", esc.chain_id);
  } catch (e) {
    if (isTreasuryMissing(e)) return fail(503, (e as Error).message, { configured: false });
    throw e;
  }

  // Any wallet the agent's user legitimately controls may be the sender.
  const senders = await buyerWallets(svc, args.buyerId);
  if (args.agentWallet) senders.push(args.agentWallet);
  const unique = Array.from(new Set(senders.map((s) => s.toLowerCase())));

  let verify: any = { ok: false, error: "no wallet on file for this buyer" };
  for (const from of unique.length ? unique : [undefined]) {
    verify = await verifyUsdcTransfer({
      chainId: esc.chain_id,
      txHash,
      expectedTo: treasury.address,
      expectedAmountUsdc: Number(esc.amount_usdc),
      expectedFrom: from,
    });
    if (verify.ok || verify.pending) break;
  }

  if (!verify.ok) {
    if (verify.pending) {
      return {
        status: 202,
        body: {
          status: "confirming",
          message: "Deposit seen on Arc but not yet deep enough. Retry shortly.",
          confirmations: verify.confirmations ?? 0,
          required_confirmations: verify.requiredConfirmations ?? null,
        },
      };
    }
    return fail(400, `deposit verification failed: ${verify.error}`);
  }

  const nextHashes = Array.isArray(esc.tx_hashes)
    ? [...esc.tx_hashes, { kind: "deposit", hash: txHash }]
    : [{ kind: "deposit", hash: txHash }];

  const { data: updated, error } = await svc
    .from("escrows")
    .update({
      status: "funded",
      deposit_tx_hash: txHash,
      funded_at: new Date().toISOString(),
      tx_hashes: nextHashes,
    })
    .eq("id", escrowId)
    .select("*")
    .single();
  if (error) {
    if ((error as any).code === "23505") {
      return fail(409, "this transaction has already funded a different escrow");
    }
    return fail(400, error.message);
  }

  await writeLedger(svc, {
    kind: "escrow_deposit",
    escrowId,
    adId: esc.ad_id,
    fromUserId: esc.buyer_id,
    chainId: esc.chain_id,
    amountUsdc: Number(esc.amount_usdc),
    txHash,
    status: "confirmed",
    idempotencyKey: `escrow_deposit:${escrowId}`,
  });

  await svc.from("ads").update({ status: "reserved" }).eq("id", esc.ad_id).eq("status", "active");

  await notify({
    userId: esc.seller_id,
    kind: "escrow_funded",
    title: "An agent funded an escrow",
    body: `${Number(esc.amount_usdc).toLocaleString()} USDC is held in escrow. Deliver the item, then the buyer releases the funds.`,
    link: `/escrow/${escrowId}`,
  });

  return ok({ escrow: updated });
}

/**
 * Buyer agent confirms delivery: pays the seller out of the escrow treasury
 * (minus the platform fee) and marks the escrow released and the ad sold.
 */
export async function releaseAgentEscrow(
  svc: any,
  args: { escrowId: string; buyerId: string },
): Promise<AgentEscrowResult> {
  const escrowId = String(args.escrowId ?? "");
  if (!escrowId) return fail(400, "escrow_id required");

  const { data: esc } = await svc.from("escrows").select("*").eq("id", escrowId).maybeSingle();
  if (!esc) return fail(404, "escrow_not_found");
  if (esc.buyer_id !== args.buyerId) return fail(403, "only the buyer can release this escrow");
  if (!["funded", "disputed"].includes(esc.status)) return fail(409, `cannot release from status ${esc.status}`);

  const fees = await loadFeeSettings(svc);
  const payout = await runPayout(svc, esc, "release", fees.saleFeeBps);
  if (!payout.ok) return fail(400, payout.error ?? "payout failed");

  const { data: updated, error } = await svc
    .from("escrows")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("id", escrowId)
    .select("*")
    .single();
  if (error) return fail(400, error.message);

  if (esc.deposit_tx_hash) {
    await svc.from("payments").insert({
      ad_id: esc.ad_id,
      buyer_id: esc.buyer_id,
      seller_id: esc.seller_id,
      amount_usdc: esc.amount_usdc,
      tx_hash: esc.deposit_tx_hash,
      chain_id: esc.chain_id,
    }).select().maybeSingle();
  }

  await svc.from("ads").update({ status: "sold", sold_at: new Date().toISOString() }).eq("id", esc.ad_id);

  await notify({
    userId: esc.seller_id,
    kind: "escrow_released",
    title: "Escrow released to you",
    body: `The buyer confirmed delivery. ${payout.sellerNet?.toLocaleString()} USDC is on its way to your wallet` +
      (payout.fee ? ` (after a ${payout.fee} USDC platform fee).` : "."),
    link: `/escrow/${escrowId}`,
  });

  return ok({
    escrow: updated,
    payout: {
      circle_transaction_id: payout.circleTransactionId,
      seller_net_usdc: payout.sellerNet,
      platform_fee_usdc: payout.fee,
    },
  });
}
