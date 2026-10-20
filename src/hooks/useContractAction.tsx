import { useState } from "react";
import { useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/functionErrors";
import {
  ERC20_APPROVE_ABI,
  MONAST_ESCROW_ABI,
  MONAST_ESCROW_ADDRESS,
  MONAST_ESCROW_CHAIN_ID,
  contractErrorMessage,
} from "@/lib/monastEscrow";
import { USDC_ADDRESS } from "@/lib/usdc";

export type ContractStep = "idle" | "approving" | "signing" | "confirming" | "syncing";

/**
 * Runs a MonastEscrowV3 call from the connected wallet: optional USDC approval,
 * the contract call, receipt, then a server sync that mirrors the event into
 * Monast. Returns the tx hash on success, throws a readable Error otherwise.
 */
export function useContractAction() {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: MONAST_ESCROW_CHAIN_ID });
  const [step, setStep] = useState<ContractStep>("idle");

  const run = async (opts: {
    functionName: string;
    args: unknown[];
    approveMicros?: bigint;
    sync?: { ad_id?: string; escrow_id?: string };
  }): Promise<string> => {
    try {
      if (chainId !== MONAST_ESCROW_CHAIN_ID) {
        try { await switchChainAsync({ chainId: MONAST_ESCROW_CHAIN_ID }); }
        catch { throw new Error("Please switch your wallet to Arc Mainnet and try again"); }
      }
      if (opts.approveMicros && opts.approveMicros > 0n) {
        setStep("approving");
        const ah = await writeContractAsync({
          address: USDC_ADDRESS, abi: ERC20_APPROVE_ABI, functionName: "approve",
          args: [MONAST_ESCROW_ADDRESS, opts.approveMicros], chainId: MONAST_ESCROW_CHAIN_ID,
        } as any);
        await client!.waitForTransactionReceipt({ hash: ah });
      }
      setStep("signing");
      const hash = await writeContractAsync({
        address: MONAST_ESCROW_ADDRESS, abi: MONAST_ESCROW_ABI,
        functionName: opts.functionName, args: opts.args, chainId: MONAST_ESCROW_CHAIN_ID,
      } as any);
      setStep("confirming");
      const rc = await client!.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("The transaction failed on-chain");
      if (opts.sync) {
        setStep("syncing");
        for (let i = 0; i < 8; i++) {
          const { data, error } = await supabase.functions.invoke("escrow-contract-sync", {
            body: { tx_hash: hash, ...opts.sync },
          });
          if (!error && !data?.error) break;
          if (data?.status === "confirming") { await new Promise((r) => setTimeout(r, 3000)); continue; }
          throw new Error(data?.error ?? (await getFunctionErrorMessage(error, "Could not record the transaction")));
        }
      }
      return hash;
    } catch (e: any) {
      throw new Error(e instanceof Error && !e.cause && !(e as any).shortMessage ? e.message : contractErrorMessage(e));
    } finally {
      setStep("idle");
    }
  };

  return { run, step, busy: step !== "idle" };
}

export const STEP_LABEL: Record<ContractStep, string> = {
  idle: "",
  approving: "Approve USDC in your wallet…",
  signing: "Confirm in your wallet…",
  confirming: "Confirming on Arc…",
  syncing: "Updating Monast…",
};
