import { supabase } from "@/integrations/supabase/client";
import { runCircleChallenge } from "@/lib/circle/client";
import { getFunctionErrorMessage } from "@/lib/functionErrors";

export type PaymentPurpose = "escrow_fund" | "listing_fee" | "promote_checkout";

/**
 * Which wallet pays: a connected self-custody wallet signs locally, a Circle
 * user-controlled wallet is signed through Circle's SDK after the server starts
 * the transfer. Mirrors the resolution used on the Settings page.
 */
export async function resolvePayingWallet(userId: string): Promise<{
  isCircleWallet: boolean;
  address: string | null;
}> {
  const { data } = await supabase
    .from("profiles")
    .select("wallet_address, circle_wallet_address")
    .eq("id", userId)
    .maybeSingle();
  if (data?.wallet_address) return { isCircleWallet: false, address: data.wallet_address };
  if (data?.circle_wallet_address) return { isCircleWallet: true, address: data.circle_wallet_address };
  return { isCircleWallet: false, address: null };
}

/**
 * One entry point for every USDC payment in the app. Self-custody keeps its
 * existing wagmi path untouched; Circle wallets get a server-initiated transfer
 * plus an SDK challenge. Either way the caller receives a txHash, so the
 * existing on-chain verification endpoints stay exactly as they are.
 */
export async function sendUsdcPayment(input: {
  purpose: PaymentPurpose;
  referenceId: string;
  isCircleWallet: boolean;
  selfCustodySend?: () => Promise<{ txHash: string }>;
}): Promise<{ txHash: string }> {
  if (!input.isCircleWallet) {
    if (!input.selfCustodySend) throw new Error("Missing self-custody sender");
    return input.selfCustodySend();
  }

  const { data, error } = await supabase.functions.invoke("circle-transfer", {
    body: {
      action: "createChallenge",
      purpose: input.purpose,
      referenceId: input.referenceId,
    },
  });
  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "Could not start payment"));
  }
  if (data?.error || !data?.challengeId) {
    throw new Error(data?.error ?? "Circle did not return the payment details");
  }

  const challengeResult = await runCircleChallenge({
    challengeId: data.challengeId,
    userToken: data.userToken,
    encryptionKey: data.encryptionKey,
  });

  // Circle does not always hand the transaction id back through the challenge
  // result. When it doesn't, ask the server to look the transfer up in Circle
  // so an approved payment can never be orphaned.
  let transactionId: string | undefined = challengeResult?.data?.id;
  if (!transactionId) {
    const resolved = await resolveCirclePayment(input.purpose, input.referenceId);
    if (resolved.txHash) return { txHash: resolved.txHash };
    transactionId = resolved.transactionId ?? undefined;
  }
  if (!transactionId) {
    throw new Error(
      "Payment was approved but Circle hasn't published the transaction yet - reopen this page in a moment and it will finish automatically.",
    );
  }

  // Circle broadcasts asynchronously - poll until a txHash exists, which is
  // what the verification endpoints need.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data: statusData, error: statusError } = await supabase.functions.invoke("circle-transfer", {
      body: { action: "status", transactionId },
    });
    if (statusError) {
      throw new Error(await getFunctionErrorMessage(statusError, "Could not check payment status"));
    }
    if (statusData?.error) throw new Error(statusData.error);
    if (statusData?.txHash) return { txHash: statusData.txHash };
    const state = String(statusData?.status ?? "").toUpperCase();
    if (["FAILED", "CANCELLED", "DENIED", "EXPIRED"].includes(state)) {
      throw new Error(statusData?.message ?? `Circle payment ${state.toLowerCase()}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Payment is taking longer than expected - check Transactions shortly.");
}

export interface ResolvedCirclePayment {
  transactionId: string | null;
  status: string | null;
  txHash: string | null;
  message: string | null;
}

/**
 * Asks the backend whether Circle already holds a transfer for this payment.
 * Used both as a fallback after a challenge that returns no transaction id and
 * as a self-heal when a page loads with the payment still unsettled.
 */
export async function resolveCirclePayment(
  purpose: PaymentPurpose,
  referenceId: string,
): Promise<ResolvedCirclePayment> {
  const { data, error } = await supabase.functions.invoke("circle-transfer", {
    body: { action: "resolve", purpose, referenceId },
  });
  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "Could not check your payment"));
  }
  if (data?.error) throw new Error(data.error);
  return {
    transactionId: data?.transactionId ?? null,
    status: data?.status ?? null,
    txHash: data?.txHash ?? null,
    message: data?.message ?? null,
  };
}

