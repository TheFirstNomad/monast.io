import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isSelfCustodyEmail } from "@/lib/session";

/**
 * Read-only view of the signed-in user's hosted (Circle) wallet state.
 * Self-custody sessions are reported as `selfCustody` and never need onboarding.
 */
export const useCircleWallet = () => {
  const { user, loading } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const selfCustody = isSelfCustodyEmail(user?.email);

  const refresh = useCallback(async () => {
    if (!user || selfCustody) {
      setAddress(null);
      setChecking(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("circle_wallet_address")
      .eq("id", user.id)
      .maybeSingle();
    setAddress((data?.circle_wallet_address as string | null) ?? null);
    setChecking(false);
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
    /** Ready to fund escrow: either self-custody, or a provisioned Circle wallet. */
    ready: selfCustody || Boolean(address),
    /** Signed-in hosted user without a wallet yet. */
    needsSetup: Boolean(user) && !selfCustody && !address,
    refresh,
  };
};
