import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { runCircleChallenge } from "@/lib/circle/client";
import { toast } from "sonner";

interface Props {
  escrowId: string;
  amount: number;
  onFunded?: () => void;
}

/**
 * Lets an email/Circle-wallet buyer fund an escrow straight from their
 * non-custodial Circle wallet. Flow:
 *   circle-escrow-fund -> PIN challenge (Circle SDK) -> poll circle-tx-status
 *   -> escrow-confirm-funded (on-chain verification, flips escrow to funded)
 */
export const CircleFundButton = ({ escrowId, amount, onFunded }: Props) => {
  const [phase, setPhase] = useState<"idle" | "preparing" | "signing" | "waiting" | "verifying">("idle");
  const busy = phase !== "idle";

  const pollTxHash = async (transactionId: string) => {
    for (let i = 0; i < 30; i++) {
      const { data } = await supabase.functions.invoke("circle-tx-status", {
        body: { transaction_id: transactionId },
      });
      if (data?.tx_hash) return data.tx_hash as string;
      if (data?.state === "FAILED" || data?.state === "CANCELLED") {
        throw new Error(`Circle transfer ${data.state.toLowerCase()}`);
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
    throw new Error("Timed out waiting for the transfer to settle");
  };

  const fund = async () => {
    try {
      setPhase("preparing");
      const { data, error } = await supabase.functions.invoke("circle-escrow-fund", {
        body: { escrow_id: escrowId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setPhase("signing");
      await runCircleChallenge({
        userToken: data.userToken,
        encryptionKey: data.encryptionKey,
        challengeId: data.challengeId,
      });

      if (!data.transactionId) {
        toast.success("Transfer submitted — refresh in a moment to see it confirmed.");
        setPhase("idle");
        return;
      }

      setPhase("waiting");
      const txHash = await pollTxHash(data.transactionId);

      setPhase("verifying");
      const { data: conf, error: confErr } = await supabase.functions.invoke("escrow-confirm-funded", {
        body: { escrow_id: escrowId, tx_hash: txHash },
      });
      if (confErr) throw new Error(confErr.message);
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
    phase === "preparing" ? "Preparing transfer…"
    : phase === "signing" ? "Confirm in Circle overlay…"
    : phase === "waiting" ? "Settling on-chain…"
    : phase === "verifying" ? "Verifying…"
    : `Pay ${amount.toLocaleString()} USDC from Circle wallet`;

  return (
    <Button onClick={fund} disabled={busy} variant="outline" className="w-full gap-2 py-5">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
      {label}
    </Button>
  );
};
