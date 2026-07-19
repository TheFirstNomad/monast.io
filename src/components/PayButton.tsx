import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { USDC_ADDRESS, ERC20_TRANSFER_ABI, toUsdcUnits, ARC_CHAIN_ID } from "@/lib/usdc";
import { toast } from "sonner";
import { useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

interface Props {
  adId: string;
  sellerId: string;
  amount: number;
}

export const PayButton = ({ adId, sellerId, amount }: Props) => {
  const { address, connect } = useWallet();
  const { user } = useAuth();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: pendingHash });
  const [recording, setRecording] = useState(false);
  const busy = isPending || confirming || recording;

  const pay = async () => {
    try {
      if (!user) { toast.error("Sign in to pay"); return; }
      if (!address) { await connect(); return; }

      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", sellerId)
        .maybeSingle();

      const to = sellerProfile?.wallet_address as `0x${string}` | null | undefined;
      if (!to) { toast.error("Seller has no wallet connected"); return; }

      if (chainId !== ARC_CHAIN_ID) {
        try {
          await switchChainAsync({ chainId: ARC_CHAIN_ID });
        } catch {
          toast.error("Please switch your wallet to Arc Testnet");
          return;
        }
      }

      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to, toUsdcUnits(amount)],
        chainId: ARC_CHAIN_ID,
      } as any);
      setPendingHash(hash);
      toast.success("Payment sent: " + hash.slice(0, 10) + "…");
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Payment failed");
    }
  };

  // Once the tx is mined, ask the backend to verify on-chain and record it.
  useEffect(() => {
    if (!isSuccess || !pendingHash || !user) return;
    (async () => {
      setRecording(true);
      try {
        const { data, error } = await supabase.functions.invoke("record-payment", {
          body: { ad_id: adId, tx_hash: pendingHash, chain_id: ARC_CHAIN_ID },
        });
        if (error) {
          toast.error(error.message);
        } else if (data?.error) {
          toast.error(data.error);
        } else {
          toast.success("Purchase verified & recorded");
        }
      } finally {
        setRecording(false);
        setPendingHash(undefined);
      }
    })();
  }, [isSuccess, pendingHash, user, adId, sellerId, amount]);

  return (
    <Button onClick={pay} disabled={busy} className="w-full gap-2 font-semibold py-5">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
      {busy ? "Processing…" : `Pay ${amount.toLocaleString()} USDC`}
    </Button>
  );
};
