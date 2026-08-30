import { supabase } from "@/integrations/supabase/client";
import { runCircleChallenge } from "@/lib/circle/client";
import { getFunctionErrorMessage } from "@/lib/functionErrors";

/**
 * Wallet home data + withdrawals for Circle (Google sign-in) wallets.
 * Self-custody wallets read their balance on-chain and send from their own
 * wallet, so they never reach these endpoints.
 */

async function call<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke("circle-transfer", { body });
  if (error) throw new Error(await getFunctionErrorMessage(error, fallback));
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export interface CircleBalance {
  balanceUsdc: number;
  address: string | null;
  chainId: number;
}

export const fetchCircleBalance = () =>
  call<CircleBalance>({ action: "balance" }, "Could not read your balance");

export interface WalletActivityItem {
  id: string | null;
  direction: "INBOUND" | "OUTBOUND" | string;
  amountUsdc: number;
  counterparty: string | null;
  state: string | null;
  txHash: string | null;
  createdAt: string | null;
}

export const fetchCircleActivity = () =>
  call<{ transactions: WalletActivityItem[] }>({ action: "activity" }, "Could not load your activity")
    .then((d) => d.transactions ?? []);

/**
 * Sends USDC out of the user's Circle wallet to any Arc address, then follows
 * the transfer until Circle publishes a transaction hash.
 */
export async function withdrawFromCircleWallet(input: {
  destinationAddress: string;
  amountUsdc: number;
  clientRequestId: string;
  onPhase?: (phase: "signing" | "settling") => void;
}): Promise<{ txHash: string }> {
  const started = await call<{
    challengeId: string;
    userToken: string;
    encryptionKey: string;
  }>(
    {
      action: "withdraw",
      destinationAddress: input.destinationAddress,
      amountUsdc: input.amountUsdc,
      clientRequestId: input.clientRequestId,
    },
    "Could not start the transfer",
  );

  input.onPhase?.("signing");
  const result = await runCircleChallenge({
    challengeId: started.challengeId,
    userToken: started.userToken,
    encryptionKey: started.encryptionKey,
  });

  // Circle does not always hand the transaction id back with the challenge
  // result. Let the backend match the transfer by destination + exact
  // micro-USDC amount so an approved transfer is never orphaned (and is never
  // sent twice - the idempotency key is derived from the same request).
  let transactionId = result?.data?.id as string | undefined;
  if (!transactionId) {
    const found = await call<{ transactionId: string | null; txHash: string | null }>(
      {
        action: "resolveWithdraw",
        destinationAddress: input.destinationAddress,
        amountUsdc: input.amountUsdc,
      },
      "Could not confirm the transfer",
    ).catch(() => null);
    if (found?.txHash) return { txHash: found.txHash };
    transactionId = found?.transactionId ?? undefined;
  }

  if (!transactionId) {
    throw new Error(
      "The transfer was approved but Circle has not published it yet - it will appear in your activity shortly.",
    );
  }

  input.onPhase?.("settling");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await call<{ status: string; txHash: string | null; message: string | null }>(
      { action: "status", transactionId },
      "Could not check the transfer",
    );
    if (status.txHash) return { txHash: status.txHash };
    const state = String(status.status ?? "").toUpperCase();
    if (["FAILED", "CANCELLED", "DENIED", "EXPIRED"].includes(state)) {
      throw new Error(status.message ?? `Transfer ${state.toLowerCase()}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("The transfer is taking longer than usual - check your activity in a moment.");
}
