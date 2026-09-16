import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WalletSetupDialog } from "@/components/WalletSetupDialog";
import { useCircleWallet } from "@/hooks/useCircleWallet";
import { Check, Loader2, ShieldCheck, Wallet } from "lucide-react";

interface Props {
  /** Optional extra line explaining why the wallet is needed right now. */
  reason?: string;
  className?: string;
  /** Show a confirmation card when the wallet is already usable. */
  showWhenReady?: boolean;
}

/**
 * Onboarding step for signed-in buyers who have no Circle wallet at all.
 * Google sign-in creates the wallet automatically, so anyone with a wallet
 * address sees nothing here - never the legacy PIN setup dialog.
 */
export const CircleOnboardingCard = ({ reason, className = "", showWhenReady = false }: Props) => {
  const { checking, needsSetup, address, selfCustody } = useCircleWallet();
  const [open, setOpen] = useState(false);

  // Nothing to show for self-custody users or wallets that already exist.
  if (selfCustody) return null;

  if (checking) {
    if (!showWhenReady) return null;
    return (
      <div className={`bg-card border border-border rounded-xl p-5 flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Checking your wallet...
      </div>
    );
  }

  if (!needsSetup) {
    if (!showWhenReady || !address) return null;
    return (
      <div className={`bg-card border border-border rounded-xl p-5 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Your payment wallet is ready</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{address}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`bg-card border border-primary/40 rounded-xl p-5 space-y-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Finish setting up your payment wallet</p>
            <p className="text-xs text-muted-foreground">
              {reason ?? "You need a wallet before you can pay into escrow. It takes a few seconds."}
            </p>
          </div>
        </div>

        <ol className="grid gap-2 text-xs">
          <Step number="01" text="Account verified" done />
          <Step number="02" text="Create your secure wallet" />
          <Step number="03" text="Pay and get paid in USDC" />
        </ol>

        <Button onClick={() => setOpen(true)} className="w-full font-semibold">
          Set up my wallet
        </Button>
      </div>

      <WalletSetupDialog open={open} onOpenChange={setOpen} onComplete={() => setOpen(false)} />
    </>
  );
};

const Step = ({ number, text, done }: { number: string; text: string; done?: boolean }) => (
  <li className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
    <span className="text-[10px] text-muted-foreground">{number}</span>
    <span
      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      }`}
    >
      {done ? <Check className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
    </span>
    <span className="text-foreground/90">{text}</span>
  </li>
);
