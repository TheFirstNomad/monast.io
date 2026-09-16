import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isSelfCustodyEmail } from "@/lib/session";

/**
 * Read-only view of the signed-in user's hosted (Circle) wallet state.
 * Self-custody sessions are reported as `selfCustody` and never need onboarding.
 *
 * Readiness is keyed on the wallet ADDRESS: a saved address means Circle already
 * created the wallet during sign-in. The Circle wallet id is only an internal
 * payment reference; when it is missing (older accounts) the app repairs it in
 * the background instead of asking the person to "set up" a wallet they have.
 */
export const useCircleWallet = () => {
  const { user, loading } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const healing = useRef(false);

  const selfCustody = isSelfCustodyEmail(user?.email);

  const refresh = useCallback(async () => {
    if (!user || selfCustody) {
      setAddress(null);
      setWalletId(null);
      setChecking(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("circle_wallet_address, circle_wallet_id")
      .eq("id", user.id)
      .maybeSingle();

    const addr = (data?.circle_wallet_address as string | null) ?? null;
    const id = (data?.circle_wallet_id as string | null) ?? null;
    setAddress(addr);
    setWalletId(id);
    setChecking(false);

    // Silent self-heal: wallet exists but the payment reference was never
    // stored. Ask the backend to re-read it from Circle once per mount.
    if (addr && !id && !healing.current) {
      healing.current = true;
      try {
        const { data: fixed } = await supabase.functions.invoke("circle-transfer", {
          body: { action: "resync" },
        });
        if (fixed?.walletId) setWalletId(String(fixed.walletId));
      } catch {
        // Payments call the same repair server-side, so this is not fatal.
      }
    }
  }, [user, selfCustody]);

  useEffect(() => {
    if (loading) return;
    void refresh();
  }, [loading, refresh]);

  return {
    /** True while the profile lookup is in flight. */
    checking: loading || checking,
    selfCustody,
    address,
    walletId,
    /** Ready to fund escrow: either self-custody, or a provisioned Circle wallet. */
    ready: selfCustody || Boolean(address),
    /** Signed-in hosted user with no wallet at all yet. */
    needsSetup: Boolean(user) && !selfCustody && !address,
    refresh,
  };
};
