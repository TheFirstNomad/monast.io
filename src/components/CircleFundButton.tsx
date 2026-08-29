import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendUsdcPayment } from "@/lib/payments/sendUsdc";
import { getFunctionErrorMessage } from "@/lib/functionErrors";
import { toast } from "sonner";

interface Props {
  escrowId: string;
  amount: number;
  onFunded?: () => void;
}

/**
 * Lets an email/Circle-wallet buyer fund an escrow from their non-custodial
 * Circle wallet. Uses the single shared payment path (sendUsdcPayment), which
 * also recovers a transfer Circle already accepted, then hands the txHash to
 * escrow-confirm-funded for on-chain verification.
 */
export const CircleFundButton = ({ escrowId, amount, onFunded }: Props) => {
  const [phase, setPhase] = useState<"idle" | "paying" | "verifying">("idle");
  const busy = phase !== "idle";

  const fund = async () => {
    try {
      setPhase("paying");
      const { txHash } = await sendUsdcPayment({
        purpose: "escrow_fund",
        referenceId: escrowId,
        isCircleWallet: true,
      });

      setPhase("verifying");
      const { data: conf, error: confErr } = await supabase.functions.invoke("escrow-confirm-funded", {
        body: { escrow_id: escrowId, tx_hash: txHash },
      });
      if (confErr) throw new Error(await getFunctionErrorMessage(confErr, "Could not verify the deposit"));
      if (conf?.error) throw new Error(conf.error);

      toast.success("Funds held in escrow");
      onFunded?.();
    } catch (e: any) {
      toast.error(e?.message || "Circle payment failed");
    } finally {
      setPhase("idle");
    }
  };

  const label =
    phase === "paying"
      ? "Confirm in the Circle window…"
      : phase === "verifying"
        ? "Verifying on Arc…"
        : `Pay ${amount.toLocaleString()} USDC from your monast wallet`;

  return (
    <Button onClick={fund} disabled={busy} variant="outline" className="w-full gap-2 py-5">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
      {label}
    </Button>
  );
};
