import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { USDC_ADDRESS, ERC20_TRANSFER_ABI, toUsdcUnits, ARC_CHAIN_ID } from "@/lib/usdc";
import { useTreasuryAddress } from "@/hooks/useTreasuryAddress";
import { toast } from "sonner";
import { useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

interface Props {
  escrowId: string;
  amount: number;
  onFunded?: () => void;
}

/**
 * Funds an existing escrow from the buyer's own (self-custody) wallet:
 * USDC transfer to the escrow treasury, then server-side on-chain verification.
 */
export const EscrowFundButton = ({ escrowId, amount, onFunded }: Props) => {
  const { address, connect } = useWallet();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const [verifying, setVerifying] = useState(false);
  const { isSuccess, isLoading: mining } = useWaitForTransactionReceipt({ hash: pendingHash });
  const { treasury, error: treasuryError, loading: treasuryLoading } = useTreasuryAddress(
    "escrow",
    ARC_CHAIN_ID,
  );
  const busy = isPending || mining || verifying;

  const fund = async () => {
    try {
      if (!address) { await connect(); return; }
      if (!treasury) {
        toast.error(treasuryError ?? "Escrow payments are unavailable right now");
        return;
      }
      if (chainId !== ARC_CHAIN_ID) {
        try { await switchChainAsync({ chainId: ARC_CHAIN_ID }); }
        catch { toast.error("Please switch your wallet to Arc Testnet"); return; }
      }
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [treasury.address, toUsdcUnits(amount)],
        chainId: ARC_CHAIN_ID,
      } as any);
      setPendingHash(hash);
      toast.success("Payment sent — waiting for confirmation…");
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Payment failed");
    }
  };

  // Confirm on the server once mined. A 202 means "not deep enough yet" — keep polling.
  useEffect(() => {
    if (!isSuccess || !pendingHash) return;
    let cancelled = false;
    (async () => {
      setVerifying(true);
      try {
        for (let attempt = 0; attempt < 12 && !cancelled; attempt++) {
          const { data, error } = await supabase.functions.invoke("escrow-confirm-funded", {
            body: { escrow_id: escrowId, tx_hash: pendingHash },
          });
          if (!error && !data?.error) {
            toast.success("Funds held in escrow");
            onFunded?.();
            return;
          }
          const message = (data?.error ?? error?.message ?? "") as string;
          if (data?.status === "confirming" || /still confirming/i.test(message)) {
            await new Promise((r) => setTimeout(r, 4000));
            continue;
          }
          toast.error(message || "Could not verify your deposit");
          return;
        }
        toast.error("Your deposit is taking longer than expected to confirm. Reload in a moment.");
      } finally {
        if (!cancelled) {
          setVerifying(false);
          setPendingHash(undefined);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isSuccess, pendingHash, escrowId, onFunded]);

  if (treasuryError) {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full gap-2 font-semibold py-5">
          <Wallet className="w-4 h-4" /> Escrow unavailable
        </Button>
        <p className="text-xs text-muted-foreground text-center">{treasuryError}</p>
      </div>
    );
  }

  return (
    <Button onClick={fund} disabled={busy || treasuryLoading} className="w-full gap-2 font-semibold py-5">
      {busy || treasuryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
      {verifying
        ? "Verifying deposit…"
        : mining
          ? "Confirming payment…"
          : isPending
            ? "Awaiting wallet…"
            : treasuryLoading
              ? "Loading…"
              : !address
                ? "Connect wallet to fund escrow"
                : `Fund escrow — ${amount.toLocaleString()} USDC`}
    </Button>
  );
};
