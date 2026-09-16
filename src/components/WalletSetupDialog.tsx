import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Wallet, Check } from "lucide-react";
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
 * then hands that challenge to the Circle Web SDK to finish initializing the
 * wallet. Circle's Social Login model has no PIN or security-question step -
 * this component only relays the challenge id.
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
        // Never hang forever on a slow Circle call: fail with a readable message.
        const { data, error: fnErr } = (await Promise.race([
          supabase.functions.invoke("circle-provision-wallet"),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Circle is taking longer than usual. Please try again.")),
              25000,
            ),
          ),
        ])) as Awaited<ReturnType<typeof supabase.functions.invoke>>;
        if (fnErr) {
          throw new Error(
            await getFunctionErrorMessage(fnErr, "We could not prepare your wallet just now."),
          );
        }
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
      // Circle creates the wallet asynchronously, so poll the provisioning
      // endpoint until it reports the wallet as ready. That call is what stores
      // the address and wallet id the payment flow needs.
      let ready = false;
      for (let attempt = 0; attempt < 8 && !ready; attempt += 1) {
        const { data } = await supabase.functions.invoke("circle-provision-wallet");
        if (data?.status === "ready") { ready = true; break; }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!ready) {
        throw new Error(
          "Your wallet is still being created. Reopen this in a moment and it will finish automatically.",
        );
      }
      setPhase("done");
      toast({ title: "Wallet ready", description: "Your Arc wallet is live." });
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
            Set up your Monast wallet
          </DialogTitle>
          <DialogDescription>
            Three short steps create a wallet for secure marketplace payments.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <FeatureRow number="01" icon={<Check className="w-4 h-4" />} text="Verify your account" />
          <FeatureRow number="02" icon={<ShieldCheck className="w-4 h-4" />} text="Secure your wallet with Circle" />
          <FeatureRow number="03" icon={<Wallet className="w-4 h-4" />} text="Receive and pay in USDC" />
        </div>

        {phase === "provisioning" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Preparing your wallet...
          </div>
        )}

        {phase === "ready" && (
          <Button onClick={startPinSetup} size="lg" className="w-full font-semibold">
            Finish wallet setup
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

const FeatureRow = ({ number, icon, text }: { number: string; icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-3 text-sm rounded-xl border border-border bg-card p-4">
    <span className="text-[10px] text-muted-foreground">{number}</span>
    <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
      {icon}
    </div>
    <p className="text-foreground/90 leading-relaxed">{text}</p>
  </div>
);
