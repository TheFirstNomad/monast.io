import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { USDC_ADDRESS, ERC20_TRANSFER_ABI, toUsdcUnits, ARC_CHAIN_ID } from "@/lib/usdc";
import { useTreasuryAddress } from "@/hooks/useTreasuryAddress";
import { toast } from "sonner";
import { useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { sendUsdcPayment, resolvePayingWallet, resolveCirclePayment } from "@/lib/payments/sendUsdc";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  escrowId: string;
  amount: number;
  onFunded?: () => void;
  /** Start the payment as soon as the button appears (used right after checkout opens the escrow). */
  autoStart?: boolean;
}


/**
 * Funds an existing escrow from the buyer's wallet - self-custody signs locally,
 * a Circle wallet signs through Circle - then the server verifies on-chain.
 */
export const EscrowFundButton = ({ escrowId, amount, onFunded }: Props) => {
  const { address, connect } = useWallet();
  const { user } = useAuth();
  const [circleWallet, setCircleWallet] = useState(false);
  const [circlePaying, setCirclePaying] = useState(false);
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
  const busy = isPending || mining || verifying || circlePaying;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    resolvePayingWallet(user.id).then((w) => {
      if (!cancelled) setCircleWallet(w.isCircleWallet);
    });
    return () => { cancelled = true; };
  }, [user]);

  // Circle wallets cannot sign locally: the server starts the transfer, the SDK
  // signs it, and we hand the resulting hash to the same verifier.
  const fundWithCircleWallet = async () => {
    setCirclePaying(true);
    try {
      const { txHash } = await sendUsdcPayment({
        purpose: "escrow_fund",
        referenceId: escrowId,
        isCircleWallet: true,
      });
      setPendingHash(txHash as `0x${string}`);
      toast.success("Payment sent. Waiting for confirmation…");
      await confirmOnServer(txHash);
    } catch (e: any) {
      toast.error(e?.message || "Payment failed");
    } finally {
      setCirclePaying(false);
    }
  };

  const fund = async () => {
    try {
      if (circleWallet) { await fundWithCircleWallet(); return; }
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
      toast.success("Payment sent. Waiting for confirmation…");
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Payment failed");
    }
  };

  // Confirm on the server once mined. A 202 means "not deep enough yet" - keep polling.
  const confirmOnServer = async (txHash: string) => {
    setVerifying(true);
    try {
      for (let attempt = 0; attempt < 12; attempt++) {
        const { data, error } = await supabase.functions.invoke("escrow-confirm-funded", {
          body: { escrow_id: escrowId, tx_hash: txHash },
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
      setVerifying(false);
      setPendingHash(undefined);
    }
  };

  useEffect(() => {
    if (!isSuccess || !pendingHash) return;
    void confirmOnServer(pendingHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, pendingHash, escrowId]);

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
              : !address && !circleWallet
                ? "Connect wallet to fund escrow"
                : `Fund escrow · ${amount.toLocaleString()} USDC`}
    </Button>
  );
};
