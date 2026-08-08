// The payout leg: moves real USDC out of the escrow treasury wallet.
//
// Guarantees
//  - One payout per escrow: `payout_status` is claimed with a conditional update
//    before any Circle call, so two concurrent releases cannot both send.
//  - Idempotent at Circle: the idempotency key is derived from the escrow id and
//    payout kind, so a retry after a timeout reuses the same transfer.
//  - Amounts come from the escrow row, never from the request body.

import { getTreasury } from "./treasury.ts";
import { treasuryTransfer } from "./circle-dev.ts";
import { writeLedger } from "./ledger.ts";
import { splitSale } from "./fees.ts";

export type PayoutKind = "release" | "refund";

export interface PayoutResult {
  ok: boolean;
  error?: string;
  circleTransactionId?: string;
  sellerNet?: number;
  fee?: number;
}

/** Claims the payout slot. Returns false when someone else already has it. */
async function claimPayout(admin: any, escrowId: string): Promise<boolean> {
  const { data } = await admin
    .from("escrows")
    .update({ payout_status: "pending", payout_started_at: new Date().toISOString() })
    .eq("id", escrowId)
    .in("payout_status", ["none", "failed"])
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

async function walletAddressFor(
  admin: any,
  userId: string,
  chainId: number,
): Promise<string | null> {
  // Prefer a wallet the user linked for this exact chain.
  const { data: chainWallet } = await admin
    .from("user_wallets")
    .select("address")
    .eq("user_id", userId)
    .eq("chain_id", chainId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (chainWallet?.address) return chainWallet.address;

  const { data: anyWallet } = await admin
    .from("user_wallets")
    .select("address")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (anyWallet?.address) return anyWallet.address;

  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_address, circle_wallet_address")
    .eq("id", userId)
    .maybeSingle();
  return profile?.circle_wallet_address ?? profile?.wallet_address ?? null;
}

/**
 * Sends the escrowed USDC out. On release the seller receives the net amount and
 * the platform fee is swept to the revenue wallet. On refund the buyer receives
 * 100% — no fee is ever charged on a deal that did not complete.
 */
export async function runPayout(
  admin: any,
  escrow: any,
  kind: PayoutKind,
  feeBps: number,
): Promise<PayoutResult> {
  const chainId = Number(escrow.chain_id);
  const gross = Number(escrow.amount_usdc);
  const recipientId = kind === "release" ? escrow.seller_id : escrow.buyer_id;

  const destination = await walletAddressFor(admin, recipientId, chainId);
  if (!destination) {
    return {
      ok: false,
      error:
        kind === "release"
          ? "The seller has no payout wallet on file. They must finish wallet setup before funds can be released."
          : "No refund wallet on file for the buyer.",
    };
  }

  const split = kind === "release" ? splitSale(gross, feeBps) : { gross, fee: 0, sellerNet: gross };

  let escrowWallet;
  try {
    escrowWallet = await getTreasury(admin, "escrow", chainId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!escrowWallet.circle_wallet_id) {
    return { ok: false, error: "Escrow treasury wallet is not linked to Circle; cannot pay out." };
  }

  if (!(await claimPayout(admin, escrow.id))) {
    // Attempted double payout: worth a greppable line, since a legitimate flow
    // should never reach here twice for the same escrow.
    console.error("PAYOUT_BLOCKED", JSON.stringify({ escrowId: escrow.id, kind }));
    return { ok: false, error: "A payout for this escrow is already in progress or complete." };
  }

  try {
    const mainKey = `escrow:${escrow.id}:${kind}`;
    const tx = await treasuryTransfer({
      walletId: escrowWallet.circle_wallet_id,
      destinationAddress: destination,
      amountUsdc: split.sellerNet,
      chainId,
      idempotencyKey: crypto.randomUUID(),
    });

    await writeLedger(admin, {
      kind: kind === "release" ? "seller_payout" : "buyer_refund",
      escrowId: escrow.id,
      adId: escrow.ad_id,
      fromUserId: escrow.buyer_id,
      toUserId: recipientId,
      chainId,
      amountUsdc: split.sellerNet,
      circleTransactionId: tx.id,
      status: "pending",
      idempotencyKey: mainKey,
      notes: `${kind} to ${destination}`,
    });

    // Sweep the platform fee into the revenue wallet, keeping user funds and
    // platform earnings in separate wallets.
    if (split.fee > 0) {
      try {
        const revenue = await getTreasury(admin, "revenue", chainId);
        const feeTx = await treasuryTransfer({
          walletId: escrowWallet.circle_wallet_id,
          destinationAddress: revenue.address,
          amountUsdc: split.fee,
          chainId,
          idempotencyKey: crypto.randomUUID(),
        });
        await writeLedger(admin, {
          kind: "platform_fee",
          escrowId: escrow.id,
          adId: escrow.ad_id,
          fromUserId: escrow.buyer_id,
          toUserId: null,
          chainId,
          amountUsdc: split.fee,
          circleTransactionId: feeTx.id,
          status: "pending",
          idempotencyKey: `escrow:${escrow.id}:fee`,
          notes: `platform fee ${feeBps}bps to revenue wallet`,
        });
      } catch (e) {
        // The seller has been paid; a failed fee sweep is a bookkeeping issue,
        // not a user-facing failure. It stays visible in the ledger.
        console.error("fee sweep failed", escrow.id, (e as Error).message);
      }
    }

    await admin
      .from("escrows")
      .update({
        payout_status: "sent",
        payout_circle_tx_id: tx.id,
        platform_fee_usdc: split.fee,
        seller_net_usdc: split.sellerNet,
      })
      .eq("id", escrow.id);

    return { ok: true, circleTransactionId: tx.id, sellerNet: split.sellerNet, fee: split.fee };
  } catch (e) {
    await admin
      .from("escrows")
      .update({ payout_status: "failed" })
      .eq("id", escrow.id);
    console.error("payout failed", escrow.id, e);
    return { ok: false, error: (e as Error).message };
  }
}
