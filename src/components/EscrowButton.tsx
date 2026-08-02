import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { USDC_ADDRESS, ERC20_TRANSFER_ABI, toUsdcUnits, ARC_CHAIN_ID } from "@/lib/usdc";
import { ESCROW_TREASURY } from "@/lib/escrow";
import { toast } from "sonner";
import { useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

interface Props {
  adId: string;
  sellerId: string;
  amount: number;
}

export const EscrowButton = ({ adId, sellerId, amount }: Props) => {
  const { address, connect } = useWallet();
  const { user } = useAuth();
  const navigate = useNavigate();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [escrowId, setEscrowId] = useState<string | null>(null);
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [hasCircleWallet, setHasCircleWallet] = useState(false);
  const [creating, setCreating] = useState(false);
  const { isSuccess, isLoading: mining } = useWaitForTransactionReceipt({ hash: pendingHash });
  const busy = isPending || mining || confirming;

  // Email-signup buyers pay from their Circle wallet instead of a browser wallet.
  useEffect(() => {
    if (!user) { setHasCircleWallet(false); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("circle_user_id")
        .eq("id", user.id)
        .maybeSingle();
      setHasCircleWallet(!!data?.circle_user_id);
    })();
  }, [user]);

  // Creates (or reuses) the escrow row and sends the buyer to the escrow page,
  // where they fund it from their Circle wallet.
  const buyWithCircle = async () => {
    if (!user) { toast.error("Sign in to buy"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("escrow-create", {
        body: { ad_id: adId, chain_id: ARC_CHAIN_ID },
      });
      if (error) { toast.error(error.message); return; }
      if (data?.error) { toast.error(data.error); return; }
      navigate(`/escrow/${data.escrow.id}`);
    } finally {
      setCreating(false);
    }
  };


  const buy = async () => {
    try {
      if (!user) { toast.error("Sign in to buy"); return; }
      if (!address) { await connect(); return; }

      // 1. Create escrow row.
      const { data: created, error } = await supabase.functions.invoke("escrow-create", {
        body: { ad_id: adId, chain_id: ARC_CHAIN_ID },
      });
      if (error) { toast.error(error.message); return; }
      if (created?.error) { toast.error(created.error); return; }
      const escrow = created.escrow;
      setEscrowId(escrow.id);

      // If already funded from a prior attempt, jump straight to detail.
      if (escrow.status !== "created") {
        navigate(`/escrow/${escrow.id}`);
        return;
      }

      // 2. Fund escrow — USDC transfer to marketplace treasury.
      if (chainId !== ARC_CHAIN_ID) {
        try { await switchChainAsync({ chainId: ARC_CHAIN_ID }); }
        catch { toast.error("Please switch your wallet to Arc Testnet"); return; }
      }
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [ESCROW_TREASURY, toUsdcUnits(Number(escrow.amount_usdc))],
        chainId: ARC_CHAIN_ID,
      } as any);
      setPendingHash(hash);
      toast.success("Payment sent — waiting for confirmation…");
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Payment failed");
    }
  };

  // Once on-chain, verify server-side and flip escrow to funded.
  useEffect(() => {
    if (!isSuccess || !pendingHash || !escrowId) return;
    (async () => {
      setConfirming(true);
      try {
        const { data, error } = await supabase.functions.invoke("escrow-confirm-funded", {
          body: { escrow_id: escrowId, tx_hash: pendingHash },
        });
        if (error) toast.error(error.message);
        else if (data?.error) toast.error(data.error);
        else {
          toast.success("Funds held in escrow");
          navigate(`/escrow/${escrowId}`);
        }
      } finally {
        setConfirming(false);
        setPendingHash(undefined);
      }
    })();
  }, [isSuccess, pendingHash, escrowId, navigate]);

  return (
    <Button onClick={buy} disabled={busy} className="w-full gap-2 font-semibold py-5">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
      {confirming ? "Verifying…" : mining ? "Confirming payment…" : isPending ? "Awaiting wallet…" : `Buy with Escrow — ${amount.toLocaleString()} USDC`}
    </Button>
  );
};
