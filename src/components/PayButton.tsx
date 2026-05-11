import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { encodeTransfer, toUsdcUnits, USDC_ADDRESS, ARC_CHAIN_ID } from "@/lib/usdc";
import { toast } from "sonner";

interface Props {
  adId: string;
  sellerId: string;
  amount: number;
}

export const PayButton = ({ adId, sellerId, amount }: Props) => {
  const { address, connect } = useWallet();
  const [paying, setPaying] = useState(false);

  const pay = async () => {
    try {
      if (!address) { await connect(); return; }
      if (!window.ethereum) { toast.error("Wallet not detected"); return; }

      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", sellerId)
        .maybeSingle();

      const to = sellerProfile?.wallet_address;
      if (!to) { toast.error("Seller has no wallet connected"); return; }

      setPaying(true);
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (parseInt(chainId, 16) !== ARC_CHAIN_ID) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + ARC_CHAIN_ID.toString(16) }],
        });
      }

      const data = encodeTransfer(to, toUsdcUnits(amount));
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: USDC_ADDRESS, data }],
      });

      toast.success("Payment sent: " + txHash.slice(0, 10) + "...");
      await supabase.from("ads").update({ status: "sold" }).eq("id", adId);
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Button onClick={pay} disabled={paying} className="w-full gap-2 font-semibold py-5">
      {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
      {paying ? "Processing..." : `Pay ${amount.toLocaleString()} USDC`}
    </Button>
  );
};
