import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { runCircleChallenge } from "@/lib/circle/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Phase = "idle" | "provisioning" | "ready" | "signing" | "done" | "error";

/**
 * Runs after a first successful email OTP login. Calls the
 * `circle-provision-wallet` edge function to mint a userToken + challengeId,
 * then hands that challenge to the Circle Web SDK so the user sets a PIN and
 * security answers. Circle never sends the PIN to our server - this component
 * only relays the challenge id.
 */
export const WalletSetupDialog = ({ open, onOpenChange, onComplete }: Props) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{
    userToken: string;
    encryptionKey: string;
    challengeId?: string;
  } | null>(null);

  useEffect(() => {
    if (!open || phase !== "idle") return;
    let cancelled = false;

    (async () => {
      setPhase("provisioning");
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "circle-provision-wallet",
        );
        if (fnErr) throw new Error(fnErr.message);
        if (!data || data.error) throw new Error(data?.error ?? "Provisioning failed");
        if (cancelled) return;

        if (data.status === "ready") {
          setPhase("done");
          toast({ title: "Wallet ready", description: "Your Circle multichain wallet is active." });
          onComplete?.();
          return;
        }
        setChallenge({
          userToken: data.userToken,
          encryptionKey: data.encryptionKey,
          challengeId: data.challengeId,
        });
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setPhase("error");
      }
    })();

    return () => { cancelled = true; };
  }, [open, phase, onComplete]);

  const startPinSetup = async () => {
    if (!challenge?.challengeId) return;
    setPhase("signing");
    setError(null);
    try {
      await runCircleChallenge({
        userToken: challenge.userToken,
        encryptionKey: challenge.encryptionKey,
        challengeId: challenge.challengeId,
      });
      setPhase("done");
      toast({ title: "Wallet ready", description: "PIN set. Your multichain wallet is live." });
      // Refresh backend state so profiles.circle_wallet_address gets populated.
      await supabase.functions.invoke("circle-provision-wallet").catch(() => {});
      onComplete?.();
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      // Reset so the next open re-checks state.
      setPhase("idle");
      setChallenge(null);
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Set up your Arc wallet
          </DialogTitle>
          <DialogDescription>
            Circle mints you a non-custodial wallet on Arc, where every monast.io trade
            settles in USDC. You pick the PIN. We never see it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FeatureRow icon={<Sparkles className="w-4 h-4" />} text="Auto-provisioned in seconds" />
          <FeatureRow icon={<ShieldCheck className="w-4 h-4" />} text="PIN + recovery questions, held by Circle's secure enclave" />
          <FeatureRow icon={<Wallet className="w-4 h-4" />} text="An Arc address ready to receive USDC" />
        </div>

        {phase === "provisioning" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Preparing your wallet...
          </div>
        )}

        {phase === "ready" && (
          <Button onClick={startPinSetup} size="lg" className="w-full font-semibold">
            Choose PIN & finish setup
          </Button>
        )}

        {phase === "signing" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Waiting for you to confirm in the Circle overlay...
          </div>
        )}

        {phase === "done" && (
          <Button onClick={() => handleClose(false)} size="lg" className="w-full font-semibold">
            Continue to dashboard
          </Button>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => { setPhase("idle"); setChallenge(null); }}
            >
              Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const FeatureRow = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-start gap-3 text-sm">
    <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
      {icon}
    </div>
    <p className="text-foreground/90 leading-relaxed">{text}</p>
  </div>
);
