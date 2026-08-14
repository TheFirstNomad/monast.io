import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";

/**
 * Guard for pages that need a session.
 *
 * A connected wallet does not instantly mean a Supabase session exists - the
 * SIWE nonce/signature round trip takes a moment, and during that window the
 * auth hook still reports "no user". Redirecting immediately is what made an
 * already-connected wallet get bounced back to the sign-in page.
 *
 * When a wallet is connected but no session exists (expired token, fresh tab,
 * an earlier abandoned signature) we ask the wallet layer to restore/complete
 * the session once, instead of forcing another "Connect wallet" click.
 *
 * `resolving` stays true while the session can still legitimately appear, so
 * callers render a loading state instead of flashing sign-in.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const { address, connecting, rehydrationStatus, ensureSession } = useWallet();
  const navigate = useNavigate();
  const [gaveUp, setGaveUp] = useState(false);
  const recovered = useRef<string | null>(null);

  const walletConnected = !!address;

  // A wallet is connected but no session yet - the signature flow owns this window.
  const walletPending = !gaveUp && !user && walletConnected && rehydrationStatus !== "failed";

  const resolving = loading || walletPending;

  // Ask the wallet layer to restore/complete the session exactly once per address.
  useEffect(() => {
    if (loading || user || !address || connecting) return;
    if (rehydrationStatus === "checking" || rehydrationStatus === "re-signed") return;
    if (recovered.current === address) return;
    recovered.current = address;
    void ensureSession();
  }, [loading, user, address, connecting, rehydrationStatus, ensureSession]);

  // Safety valve: never hang forever if the signature is abandoned.
  useEffect(() => {
    if (!walletPending) return;
    const t = setTimeout(() => setGaveUp(true), 20000);
    return () => clearTimeout(t);
  }, [walletPending]);

  useEffect(() => {
    if (user) {
      setGaveUp(false);
      recovered.current = null;
    }
  }, [user]);

  useEffect(() => {
    if (resolving || user) return;
    navigate("/auth", { replace: true });
  }, [resolving, user, navigate]);

  return { user, resolving };
}
