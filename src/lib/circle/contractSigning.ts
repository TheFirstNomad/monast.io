import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/functionErrors";
import { runCircleChallenge } from "./client";

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("circle-contract", { body });
  if (error) throw new Error(await getFunctionErrorMessage(error, "Could not authorize the escrow transaction"));
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Each persisted request is recovered by its own challenge, never by amount. */
export async function signCircleContract(input: {
  operation: string; referenceId: string; phase: "approve" | "execute";
}, onConfirming: () => void): Promise<`0x${string}`> {
  const request = await invoke({ action: "create", ...input });
  if (request.txHash) return request.txHash;
  let transactionId: string | undefined;
  if (!request.submitted) {
    const result = await runCircleChallenge(request);
    transactionId = result.data?.id;
  }
  onConfirming();
  for (let attempt = 0; attempt < 40; attempt++) {
    const state = await invoke({ action: "status", requestId: request.requestId, ...(transactionId ? { transactionId } : {}) });
    if (state.txHash) return state.txHash;
    if (["FAILED", "CANCELLED", "DENIED", "EXPIRED"].includes(state.status)) {
      throw new Error("The wallet transaction did not complete. No new payment was started.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Your approval is still processing. Retry this action to check the same transaction; do not start another payment.");
}