import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";

/**
 * Guard for pages that need a session.
 *
 * A connected wallet does not instantly mean a Supabase session exists — the
 * SIWE nonce/signature round trip takes a moment, and during that window the
 * auth hook still reports "no user". Redirecting immediately is what made an
 * already-connected wallet get bounced back to the sign-in page.
 *
 * `resolving` stays true while the session can still legitimately appear, so
 * callers render a loading state instead of flashing sign-in.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const { address, connecting, rehydrationStatus } = useWallet();
  const navigate = useNavigate();
  const [gaveUp, setGaveUp] = useState(false);

  // A wallet is connected but no session yet — the signature flow owns this window.
  const walletPending =
    !gaveUp &&
    !user &&
    !!address &&
    rehydrationStatus !== "failed" &&
    (connecting || rehydrationStatus === "checking" || rehydrationStatus === "re-signed" || rehydrationStatus === "idle");

  const resolving = loading || walletPending;

  // Safety valve: never hang forever if the signature is abandoned.
  useEffect(() => {
    if (!walletPending) return;
    const t = setTimeout(() => setGaveUp(true), 20000);
    return () => clearTimeout(t);
  }, [walletPending]);

  useEffect(() => {
    if (user) setGaveUp(false);
  }, [user]);

  useEffect(() => {
    if (resolving || user) return;
    navigate("/auth", { replace: true });
  }, [resolving, user, navigate]);

  return { user, resolving };
}
