import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { SignInChoice } from "@/components/SignInChoice";
import { WalletSetupDialog } from "@/components/WalletSetupDialog";
import { supabase } from "@/integrations/supabase/client";

// Self-custody sessions are created by SIWE with a synthetic email on this
// domain. Those users already hold their own keys, so no Circle wallet.
const SELF_CUSTODY_EMAIL_DOMAIN = "@wallet.monast.io";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [walletSetupOpen, setWalletSetupOpen] = useState(false);
  const provisioned = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    const email = user.email ?? "";
    const isSelfCustody = email.endsWith(SELF_CUSTODY_EMAIL_DOMAIN);

    if (isSelfCustody) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // Email sign-in: make sure a Circle wallet exists before moving on.
    if (provisioned.current) return;
    provisioned.current = true;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("circle-provision-wallet");
        if (error) throw error;
        if (data?.status === "ready") {
          navigate("/dashboard", { replace: true });
          return;
        }
        setWalletSetupOpen(true);
      } catch {
        // Provisioning can be retried from the dialog; don't trap the user here.
        setWalletSetupOpen(true);
      }
    })();
  }, [user, loading, navigate]);

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <SignInChoice onDone={() => {}} />

        <div className="mt-8 text-xs text-muted-foreground text-center">
          <Link to="/" className="hover:text-foreground">← Back to home</Link>
        </div>
      </div>

      <WalletSetupDialog
        open={walletSetupOpen}
        onOpenChange={setWalletSetupOpen}
        onComplete={() => navigate("/dashboard", { replace: true })}
      />
    </Layout>
  );
};

export default Auth;
