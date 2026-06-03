import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";

const Auth = () => {
  const { user } = useAuth();
  const { connect, connecting, address } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Sign in with your wallet</h1>
        <p className="text-muted-foreground mb-8">
          Connect any EVM wallet to start buying and selling with USDC. We'll ask you to sign a
          one-time message — no gas, no password.
        </p>

        <Button onClick={connect} disabled={connecting} size="lg" className="w-full gap-2 font-semibold">
          <Wallet className="w-5 h-5" />
          {connecting
            ? address
              ? "Confirm signature in your wallet..."
              : "Opening wallet..."
            : "Connect wallet to continue"}
        </Button>

        <p className="mt-8 text-xs text-muted-foreground">
          Email & social sign-in (with an embedded wallet) coming soon.
        </p>

        <div className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to home</Link>
        </div>
      </div>
    </Layout>
  );
};

export default Auth;
