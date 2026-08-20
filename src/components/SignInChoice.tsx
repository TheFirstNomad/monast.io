import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Wallet, ShieldCheck, Coins, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Mode = "wallet" | "email";

/**
 * Two ways in:
 *  - Self-custody: connect a wallet and sign the message (no password, no email).
 *  - Email: a magic link, after which a Circle multichain wallet on Arc is
 *    provisioned for the account (handled on /auth once the session lands).
 */
export const SignInChoice = ({ onDone }: { onDone?: () => void }) => {
  const { connect, connecting, address } = useWallet();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("wallet");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // `connect()` only opens the wallet modal; the session appears later, once
  // the user picks a wallet and signs. Wait for that before moving on.
  useEffect(() => {
    if (user) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const connectSelfCustody = async () => {
    await connect();
  };

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      toast({
        title: "Could not send the link",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Check your inbox</h1>
        <p className="text-muted-foreground mb-6">
          We sent a sign-in link to <span className="text-foreground font-medium">{email.trim()}</span>.
          Open it on this device to finish signing in.
        </p>
        <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        {mode === "wallet" ? (
          <Wallet className="w-8 h-8 text-primary" />
        ) : (
          <Mail className="w-8 h-8 text-primary" />
        )}
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to monast.io</h1>
      <p className="text-muted-foreground mb-6">
        {mode === "wallet"
          ? "Connect your wallet and sign a message. You pay and get paid in USDC on Arc. monast.io never holds your keys."
          : "Sign in with your email and we set up a Circle wallet on Arc for you. You pick the PIN, so the wallet stays yours."}
      </p>

      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted mb-6">
        <button
          type="button"
          onClick={() => setMode("wallet")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
            mode === "wallet" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Wallet className="w-4 h-4" /> Wallet
        </button>
        <button
          type="button"
          onClick={() => setMode("email")}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
            mode === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Mail className="w-4 h-4" /> Email
        </button>
      </div>

      {mode === "wallet" ? (
        <>
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
        </>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            sendMagicLink();
          }}
        >
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
          />
          <Button
            type="submit"
            size="lg"
            disabled={sending || !email.trim()}
            className="w-full gap-2 font-semibold"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
            {sending ? "Sending link..." : "Email me a sign-in link"}
          </Button>
          <p className="text-xs text-muted-foreground">
            No password. We email you a one-time link.
          </p>
        </form>
      )}

      <div className="mt-10 grid gap-3 text-left">
        {[
          { Icon: ShieldCheck, title: "No password, no seed phrase to hand over", body: "Your signature or a one-time link is the login. Nothing to leak." },
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
