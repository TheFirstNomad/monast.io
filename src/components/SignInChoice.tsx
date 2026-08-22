import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Wallet, ShieldCheck, Coins, Mail, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  initGoogleSocialLogin,
  runCircleChallenge,
  startGoogleSocialLogin,
} from "@/lib/circle/client";
import { toast } from "@/hooks/use-toast";

type Mode = "wallet" | "email";

/**
 * Two ways in:
 *  - Self-custody: connect a wallet and sign the message (no password, no email).
 *  - Google via Circle Social Login: Circle owns the Google flow and mints the
 *    userToken, then a non-custodial SCA wallet on Arc is created. A Supabase
 *    session for the real Google email is minted server-side afterwards.
 */
export const SignInChoice = ({ onDone }: { onDone?: () => void }) => {
  const { connect, connecting, address } = useWallet();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("wallet");
  const [googleLoading, setGoogleLoading] = useState(false);
  const handling = useRef(false);

  // `connect()` only opens the wallet modal; the session appears later, once
  // the user picks a wallet and signs. Wait for that before moving on.
  useEffect(() => {
    if (user) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const connectSelfCustody = async () => {
    await connect();
  };

  // Turns a finished Circle social login into: Arc wallet + Supabase session.
  const finishSocialLogin = useCallback(
    async (
      error: { message: string } | undefined,
      result:
        | {
            userToken: string;
            encryptionKey: string;
            oAuthInfo?: { socialUserInfo?: { email?: string } };
          }
        | undefined,
    ) => {
      if (handling.current) return;
      if (error) {
        setGoogleLoading(false);
        toast({
          title: "Could not sign you in",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      if (!result?.userToken) return;
      handling.current = true;
      setGoogleLoading(true);

      try {
        const email = result.oAuthInfo?.socialUserInfo?.email;
        if (!email) throw new Error("Google did not share an email address.");

        const { data, error: fnErr } = await supabase.functions.invoke("circle-social", {
          body: { action: "complete", userToken: result.userToken, email },
        });
        if (fnErr) throw new Error(fnErr.message);
        if (!data || data.error) throw new Error(data?.error ?? "Sign-in failed");

        // Sign into Lovable Cloud with the real Google email.
        const { error: sessErr } = await supabase.auth.verifyOtp({
          email: data.email,
          token_hash: data.tokenHash,
          type: "email",
        });
        if (sessErr) throw new Error(sessErr.message);

        // A brand new Circle user still needs to pick a PIN.
        if (data.status === "challenge" && data.challengeId) {
          await runCircleChallenge({
            userToken: result.userToken,
            encryptionKey: result.encryptionKey,
            challengeId: data.challengeId,
          });
        }

        toast({ title: "You're in", description: "Your Arc wallet is ready." });
        onDone?.();
      } catch (e) {
        handling.current = false;
        toast({
          title: "Could not sign you in",
          description: (e as Error).message,
          variant: "destructive",
        });
      } finally {
        setGoogleLoading(false);
      }
    },
    [onDone],
  );

  // Register the Circle SDK login callback up front so the redirect back from
  // Google is picked up on load, not only when the button is pressed.
  useEffect(() => {
    if (user) return;
    initGoogleSocialLogin(finishSocialLogin as never).catch(() => {
      /* surfaced when the user actually presses the button */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      await initGoogleSocialLogin(finishSocialLogin as never);
      await startGoogleSocialLogin();
    } catch (e) {
      setGoogleLoading(false);
      toast({
        title: "Could not sign you in",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };


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
          : "One tap with the Google account you are already signed in to. We set up a Circle wallet on Arc for you, and you pick the PIN, so the wallet stays yours."}
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
        <>
          <Button
            onClick={continueWithGoogle}
            disabled={googleLoading}
            size="lg"
            variant="outline"
            className="w-full gap-3 font-semibold"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleMark />
            )}
            {googleLoading ? "Signing you in..." : "Continue with Google"}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            No password, no code to type. Uses the Google account on this browser.
          </p>
        </>
      )}

      <div className="mt-10 grid gap-3 text-left">
        {[
          { Icon: ShieldCheck, title: "No password, no seed phrase to hand over", body: "Your signature or your Google account is the login. Nothing to leak." },
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

const GoogleMark = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.2h6.6c-.1 1.1-.9 2.8-2.6 3.9l-.1.1 3.8 3c2.4-2.2 3.8-5.5 3.8-9z" />
    <path fill="#34A853" d="M12 24c3.5 0 6.4-1.2 8.5-3.1l-4-3.1c-1.1.8-2.6 1.3-4.5 1.3-3.4 0-6.3-2.2-7.3-5.3l-.1.1-4 3.1C2.6 21.3 7 24 12 24z" />
    <path fill="#FBBC05" d="M4.7 13.8c-.3-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5V8.7l-4-3.1C.4 7.3 0 9.6 0 11.3s.4 4 1.1 5.7l3.6-3.2z" />
    <path fill="#EA4335" d="M12 4.7c2.4 0 4 1 4.9 1.9l3.6-3.5C18.4 1.2 15.5 0 12 0 7 0 2.6 2.7 1.1 6.7l3.6 2.8C5.7 6.9 8.6 4.7 12 4.7z" />
  </svg>
);

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
