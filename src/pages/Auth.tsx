import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { SignInChoice } from "@/components/SignInChoice";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect as soon as a session exists — whether the visitor arrived signed
  // in or the wallet signature completed while they were on this page.
  useEffect(() => {
    if (loading || !user) return;
    navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);



  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <SignInChoice onDone={() => navigate("/dashboard", { replace: true })} />

        <div className="mt-8 text-xs text-muted-foreground text-center">
          <Link to="/" className="hover:text-foreground">← Back to home</Link>
        </div>
      </div>
    </Layout>
  );
};

export default Auth;
