import { supabase } from "@/integrations/supabase/client";
import { runCircleChallenge } from "@/lib/circle/client";

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
  if (error || !data?.challengeId) {
    throw new Error(data?.error ?? error?.message ?? "Could not start payment");
  }

  const result = await runCircleChallenge({
    challengeId: data.challengeId,
    userToken: data.userToken,
    encryptionKey: data.encryptionKey,
  });

  const transactionId = result?.data?.id ?? data.challengeId;

  // Circle broadcasts asynchronously - poll until a txHash exists, which is
  // what the verification endpoints need.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data: statusData } = await supabase.functions.invoke("circle-transfer", {
      body: { action: "status", transactionId },
    });
    if (statusData?.txHash) return { txHash: statusData.txHash };
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Payment is taking longer than expected - check Transactions shortly.");
}
