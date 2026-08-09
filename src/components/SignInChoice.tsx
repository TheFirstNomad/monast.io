import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Wallet, ShieldCheck, Coins } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";

/**
 * Self-custody sign-in. Connecting a wallet and signing the message creates the
 * monast.io session — there is no password and no email step.
 * (Email + Circle wallet sign-in is parked for a later release.)
 */
export const SignInChoice = ({ onDone }: { onDone?: () => void }) => {
  const { connect, connecting, address } = useWallet();
  const { user } = useAuth();

  // `connect()` only opens the wallet modal; the session appears later, once
  // the user picks a wallet and signs. Wait for that before moving on.
  useEffect(() => {
    if (user) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const connectSelfCustody = async () => {
    await connect();
  };


  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Wallet className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to monast.io</h1>
      <p className="text-muted-foreground mb-8">
        Connect your wallet and sign a message. You pay and get paid in USDC on Arc — monast.io
        never holds your keys.
      </p>

      <Button
        onClick={connectSelfCustody}
        disabled={connecting}
        size="lg"
        className="w-full gap-2 font-semibold"
      >
        <Wallet className="w-5 h-5" />
        {connecting
          ? address
            ? "Confirm signature in your wallet..."
            : "Opening wallet..."
          : "Connect wallet"}
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        MetaMask, OKX Wallet, Trust Wallet, Base App and Binance Wallet.
      </p>

      <div className="mt-10 grid gap-3 text-left">
        {[
          { Icon: ShieldCheck, title: "No password, no seed phrase to hand over", body: "Your signature is the login. Nothing to leak." },
          { Icon: Coins, title: "USDC on Arc", body: "Escrow holds the buyer's funds until the item is confirmed delivered." },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-foreground">{title}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SignInChoiceDialog = ({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <div className="pt-2">
        <SignInChoice
          onDone={() => {
            onOpenChange(false);
            onDone?.();
          }}
        />
      </div>
    </DialogContent>
  </Dialog>
);
