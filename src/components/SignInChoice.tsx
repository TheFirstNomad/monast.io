import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Wallet, Mail, Loader2, ArrowLeft } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { WalletSetupDialog } from "@/components/WalletSetupDialog";

type Step = "choose" | "email" | "otp";

/**
 * Shared sign-in chooser: Circle email wallet or self-custody wallet.
 * Used by the /auth page and by the swap panel so both look identical.
 */
export const SignInChoice = ({ onDone }: { onDone?: () => void }) => {
  const { connect, connecting, address } = useWallet();

  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !cleaned.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleaned,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setSending(false);
    if (error) {
      toast({ title: "Could not send code", description: error.message, variant: "destructive" });
      return;
    }
    setStep("otp");
    toast({ title: "Check your email", description: "We sent a 6-digit code and a magic link." });
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setVerifying(false);
    if (error) {
      toast({ title: "Invalid code", description: error.message, variant: "destructive" });
      return;
    }
    setWalletDialogOpen(true);
  };

  const connectSelfCustody = async () => {
    await connect();
    onDone?.();
  };

  return (
    <>
      {step !== "choose" && (
        <button
          onClick={() => setStep(step === "otp" ? "email" : "choose")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      {step === "choose" && (
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to monast.io</h1>
          <p className="text-muted-foreground mb-8">
            Pick how you want to trade. Either option pays and receives USDC on Arc.
          </p>

          <Button
            onClick={() => setStep("email")}
            size="lg"
            className="w-full gap-2 font-semibold mb-3"
          >
            <Mail className="w-5 h-5" />
            Continue with email
          </Button>
          <p className="text-xs text-muted-foreground mb-6">
            Instant multichain wallet powered by Circle. No seed phrase to remember.
          </p>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            onClick={connectSelfCustody}
            disabled={connecting}
            size="lg"
            variant="outline"
            className="w-full gap-2 font-semibold"
          >
            <Wallet className="w-5 h-5" />
            {connecting
              ? address
                ? "Confirm signature in your wallet..."
                : "Opening wallet..."
              : "Connect self-custody wallet"}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            MetaMask, Rainbow, Coinbase Wallet, WalletConnect and more.
          </p>
        </div>
      )}

      {step === "email" && (
        <form onSubmit={sendOtp}>
          <h2 className="text-xl font-bold text-foreground mb-2">Enter your email</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We'll send you a 6-digit code and a magic link.
          </p>
          <Input
            type="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4"
          />
          <Button type="submit" disabled={sending} size="lg" className="w-full gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send code
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOtp}>
          <h2 className="text-xl font-bold text-foreground mb-2">Enter the 6-digit code</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sent to <span className="text-foreground font-medium">{email}</span>. The magic link in
            the email also works.
          </p>
          <Input
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mb-4 text-center tracking-[0.5em] text-lg font-mono"
          />
          <Button type="submit" disabled={verifying} size="lg" className="w-full gap-2">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Verify & continue
          </Button>
        </form>
      )}

      <WalletSetupDialog
        open={walletDialogOpen}
        onOpenChange={setWalletDialogOpen}
        onComplete={() => {
          setWalletDialogOpen(false);
          onDone?.();
        }}
      />
    </>
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
