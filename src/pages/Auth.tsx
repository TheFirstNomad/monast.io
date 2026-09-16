import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { SignInChoice } from "@/components/SignInChoice";
import { WalletSetupDialog } from "@/components/WalletSetupDialog";
import { supabase } from "@/integrations/supabase/client";
import { isSelfCustodyEmail } from "@/lib/session";


const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [walletSetupOpen, setWalletSetupOpen] = useState(false);
  const provisioned = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    const isSelfCustody = isSelfCustodyEmail(user.email);

    // Circle Social Login already created the Arc wallet during sign-in.
    const socialState = sessionStorage.getItem("monast.circleSocial");
    const socialHandled = socialState === "1";

    // Circle Social Login creates the auth session before the wallet finishes
    // initializing (no PIN step in this auth method). Do not race the legacy
    // provisioner.
    if (socialState === "pending") return;

    if (isSelfCustody || socialHandled) {
      sessionStorage.removeItem("monast.circleSocial");
      navigate("/dashboard", { replace: true });
      return;
    }

    // Any account that already has a hosted wallet is done - never run the
    // legacy PIN provisioner for a returning Google user.
    if (provisioned.current) return;
    provisioned.current = true;

    (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("circle_wallet_address")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.circle_wallet_address) {
          navigate("/dashboard", { replace: true });
          return;
        }

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
      <div className="max-w-md mx-auto px-4 py-16 md:py-24">
        <Link to="/" className="block text-center font-display text-3xl text-foreground mb-10">Monast</Link>
        <SignInChoice onDone={() => navigate("/dashboard", { replace: true })} />

        <div className="mt-8 text-xs text-muted-foreground text-center">
          <Link to="/" className="hover:text-foreground">Back to the market</Link>
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
