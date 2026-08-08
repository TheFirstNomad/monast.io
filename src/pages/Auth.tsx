import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { SignInChoice } from "@/components/SignInChoice";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const checked = useRef(false);

  // Only bounce visitors who arrive already signed in — a session created
  // during this visit is handled by the sign-in flow itself (Circle wallet
  // setup must finish first).
  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    if (user) navigate("/dashboard", { replace: true });
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
