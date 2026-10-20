import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, RotateCcw, AlertTriangle, Truck, Download, Clock } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";
import { useContractAction, STEP_LABEL } from "@/hooks/useContractAction";
import { MONAST_ESCROW_ABI, MONAST_ESCROW_ADDRESS, MONAST_ESCROW_CHAIN_ID } from "@/lib/monastEscrow";

interface Props {
  escrowId: string;
  onchainEscrowId: string;
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  deliveryMarkedAt: string | null;
  autoReleaseAt: string | null;
  onChanged: () => void;
}

/** Buyer/seller actions for escrows held by MonastEscrowV3, signed from the user's wallet. */
export const ContractEscrowActions = (p: Props) => {
  const { address, connect } = useWallet();
  const { run, step, busy } = useContractAction();
  const [label, setLabel] = useState<string | null>(null);

  const pending = useReadContract({
    address: MONAST_ESCROW_ADDRESS,
    abi: MONAST_ESCROW_ABI,
    functionName: "getPendingWithdrawal",
    args: address ? [address] : undefined,
    chainId: MONAST_ESCROW_CHAIN_ID,
    query: { enabled: !!address },
  });
  const withdrawable = typeof pending.data === "bigint" ? pending.data : 0n;
  useEffect(() => { void pending.refetch(); }, [p.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (name: string, functionName: string, done: string) => {
    if (!address) { await connect(); return; }
    setLabel(name);
    try {
      await run({ functionName, args: functionName === "withdraw" ? [] : [p.onchainEscrowId], sync: functionName === "withdraw" ? undefined : { escrow_id: p.escrowId } });
      toast.success(done);
      await pending.refetch();
      p.onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setLabel(null);
    }
  };

  const spin = (name: string, icon: React.ReactNode) => (label === name ? <Loader2 className="w-4 h-4 animate-spin" /> : icon);
  const active = p.status === "funded" || p.status === "disputed";
  const autoReady = p.autoReleaseAt && new Date(p.autoReleaseAt).getTime() <= Date.now();

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Held by the Monast escrow contract on Arc Mainnet. Each action is signed from your wallet.
      </p>
      {busy && <p className="text-sm text-primary">{STEP_LABEL[step]}</p>}

      {p.isBuyer && active && (
        <Button onClick={() => act("release", "confirmDelivery", "Released to the seller")} disabled={busy} className="w-full gap-2 py-5">
          {spin("release", <CheckCircle2 className="w-4 h-4" />)} Confirm received & release to seller
        </Button>
      )}
      {p.isSeller && p.status === "funded" && !p.deliveryMarkedAt && (
        <Button variant="outline" onClick={() => act("ready", "markReadyForRelease", "Marked as delivered")} disabled={busy} className="w-full gap-2 py-5">
          {spin("ready", <Truck className="w-4 h-4" />)} Mark as delivered
        </Button>
      )}
      {p.isSeller && p.status === "funded" && p.deliveryMarkedAt && autoReady && (
        <Button variant="outline" onClick={() => act("auto", "claimAutoRelease", "Released to you")} disabled={busy} className="w-full gap-2 py-5">
          {spin("auto", <Clock className="w-4 h-4" />)} Claim automatic release
        </Button>
      )}
      {p.isSeller && active && (
        <Button variant="outline" onClick={() => act("refund", "refundBuyer", "Buyer refunded in full")} disabled={busy} className="w-full gap-2 py-5">
          {spin("refund", <RotateCcw className="w-4 h-4" />)} Refund the buyer
        </Button>
      )}
      {(p.isBuyer || p.isSeller) && p.status === "funded" && (
        <Button variant="secondary" onClick={() => act("dispute", "openDispute", "Dispute opened")} disabled={busy} className="w-full gap-2 py-5">
          {spin("dispute", <AlertTriangle className="w-4 h-4" />)} Open a dispute
        </Button>
      )}
      {withdrawable > 0n && (
        <Button onClick={() => act("withdraw", "withdraw", "USDC sent to your wallet")} disabled={busy} className="w-full gap-2 py-5">
          {spin("withdraw", <Download className="w-4 h-4" />)} Withdraw {(Number(withdrawable) / 1e6).toLocaleString()} USDC to your wallet
        </Button>
      )}
    </div>
  );
};
