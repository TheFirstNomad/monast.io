import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ProSellerBadge } from "@/components/ProSellerBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useTreasuryAddress } from "@/hooks/useTreasuryAddress";
import { USDC_ADDRESS, ERC20_TRANSFER_ABI, toUsdcUnits, ARC_CHAIN_ID } from "@/lib/usdc";
import { ACTIVE_CHAIN } from "@/lib/chains";
import { useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { Check, Sparkles, Loader2, ArrowRight, Zap, TrendingUp, Users } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { sendUsdcPayment, resolvePayingWallet } from "@/lib/payments/sendUsdc";

const PRO_PRICE_USDC = 5;
const PRO_DURATION_DAYS = 30;

interface Subscription {
  id: string;
  expires_at: string;
  plan: string;
}

const ProSeller = () => {
  useSeo({
    title: "monast.io | Pro Seller",
    description: "Upgrade to Pro Seller on monast.io. Zero listing fees, lower platform fee, Pro badge, and priority agent discovery for 5 USDC/month.",
    canonicalPath: "/pro",
  });

  const { user } = useAuth();
  const { address, connect } = useWallet();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: txConfirmed, isLoading: confirming } = useWaitForTransactionReceipt({ hash: pendingHash });
  const { treasury } = useTreasuryAddress("revenue", ARC_CHAIN_ID);

  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [activating, setActivating] = useState(false);
  const [circleWallet, setCircleWallet] = useState(false);
  const [circlePaying, setCirclePaying] = useState(false);

  const busy = isPending || confirming || activating || circlePaying;

  // Load active subscription
  useEffect(() => {
    if (!user) { setLoadingSub(false); return; }
    supabase
      .from("pro_subscriptions")
      .select("id, expires_at, plan")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setActiveSub(data as Subscription | null); setLoadingSub(false); });
  }, [user]);

  // Detect Circle wallet
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("circle_wallet_id").eq("id", user.id).maybeSingle()
      .then(({ data }) => setCircleWallet(Boolean(data?.circle_wallet_id)));
  }, [user]);

  // Activate subscription after payment confirmed
  useEffect(() => {
    if (!txConfirmed || !pendingHash || !user) return;
    setActivating(true);
    const expiresAt = new Date(Date.now() + PRO_DURATION_DAYS * 86_400_000).toISOString();
    supabase.from("pro_subscriptions")
      .upsert({ user_id: user.id, plan: "pro", expires_at: expiresAt, tx_hash: pendingHash }, { onConflict: "user_id" })
      .then(({ error }) => {
        setActivating(false);
        if (error) { toast.error("Payment confirmed but activation failed. Contact support with your tx hash."); return; }
        toast.success("Pro Seller activated! Your badge is live.");
        setActiveSub({ id: "new", expires_at: expiresAt, plan: "pro" });
      });
  }, [txConfirmed, pendingHash, user]);

  const handleSubscribe = async () => {
    if (!user) { toast.error("Sign in to subscribe"); return; }
    if (!treasury) { toast.error("Treasury not available, try again shortly"); return; }

    const paying = await resolvePayingWallet(user.id, address ?? null);

    if (paying === "circle") {
      setCirclePaying(true);
      try {
        await sendUsdcPayment({ amountUsdc: PRO_PRICE_USDC, to: treasury, userId: user.id, description: "Pro Seller subscription" });
        const expiresAt = new Date(Date.now() + PRO_DURATION_DAYS * 86_400_000).toISOString();
        const { error } = await supabase.from("pro_subscriptions")
          .upsert({ user_id: user.id, plan: "pro", expires_at: expiresAt, tx_hash: "circle" }, { onConflict: "user_id" });
        if (error) throw error;
        toast.success("Pro Seller activated!");
        setActiveSub({ id: "new", expires_at: expiresAt, plan: "pro" });
      } catch (e: any) {
        toast.error(e?.message ?? "Payment failed");
      } finally {
        setCirclePaying(false);
      }
      return;
    }

    if (!address) { connect(); return; }
    try {
      if (chainId !== ARC_CHAIN_ID) await switchChainAsync({ chainId: ARC_CHAIN_ID as typeof ACTIVE_CHAIN.id });
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [treasury as `0x${string}`, toUsdcUnits(PRO_PRICE_USDC)],
        chain: ACTIVE_CHAIN,
        account: address as `0x${string}`,
      });
      setPendingHash(hash);
    } catch (e: any) {
      if (!e?.message?.includes("rejected")) toast.error(e?.message ?? "Transaction failed");
    }
  };

  const expiresFormatted = activeSub
    ? new Date(activeSub.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <Layout>
      {/* Hero */}
      <section className="border-b border-border px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          <ProSellerBadge size="md" className="mx-auto" />
          <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.02]">
            Sell more.<br />Pay less.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Pro Seller unlocks zero listing fees, a lower platform fee, priority agent discovery, and your badge on every listing.
          </p>
          <div className="text-4xl font-display price-nums">
            5 <span className="text-xl font-medium text-muted-foreground">USDC / month</span>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="px-4 py-14 border-b border-border">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-6">
          {[
            { icon: <Zap className="w-5 h-5 text-primary" />, title: "Zero listing fees", body: "Post unlimited listings without paying the 0.15 USDC per-listing fee." },
            { icon: <TrendingUp className="w-5 h-5 text-primary" />, title: "Lower platform fee", body: "Pay 1.5% instead of 2.5% on every successful sale. At 1,000 USDC/month GMV that saves 10 USDC." },
            { icon: <Users className="w-5 h-5 text-primary" />, title: "Agent priority", body: "AI agent buyers see Pro Seller listings first in every search and browse endpoint." },
          ].map(({ icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 space-y-3">
              {icon}
              <div className="font-semibold">{title}</div>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Subscribe card */}
      <section className="px-4 py-14">
        <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 space-y-6">
          {loadingSub ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : activeSub ? (
            <div className="text-center space-y-3">
              <ProSellerBadge size="md" className="mx-auto" />
              <p className="text-sm text-muted-foreground">Your Pro Seller subscription is active.</p>
              <p className="text-xs text-muted-foreground">Renews or expires on <span className="text-foreground font-medium">{expiresFormatted}</span>.</p>
              <Button className="w-full" onClick={handleSubscribe} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Extend 30 days
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <h2 className="text-xl font-bold">Activate Pro Seller</h2>
                <p className="text-sm text-muted-foreground">One payment of 5 USDC activates your Pro badge for 30 days.</p>
                <ul className="space-y-2 text-sm">
                  {["Zero listing fees for 30 days", "1.5% platform fee (vs 2.5% standard)", "Pro badge on every listing", "Priority in agent API results"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {!user ? (
                <Button className="w-full" asChild><a href="/auth">Sign in to subscribe</a></Button>
              ) : (
                <Button className="w-full" onClick={handleSubscribe} disabled={busy}>
                  {busy
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
                    : <><Sparkles className="w-4 h-4 mr-2" />Subscribe for 5 USDC</>}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Payment settles in USDC on Arc. No recurring charge — manual renewal only.
              </p>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default ProSeller;
