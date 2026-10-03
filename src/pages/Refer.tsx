import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Copy, Check, Users, Gift, TrendingUp } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

interface ReferralStats {
  total_referrals: number;
  credited_referrals: number;
  total_earned_usdc: number;
}

const Refer = () => {
  useSeo({
    title: "monast.io | Refer & Earn",
    description: "Refer friends to monast.io and earn 0.10 USDC for every listing fee they pay. No limit.",
    canonicalPath: "/refer",
  });

  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats>({ total_referrals: 0, credited_referrals: 0, total_earned_usdc: 0 });
  const [copied, setCopied] = useState(false);

  const referralCode = user ? `${user.id.slice(0, 8)}` : null;
  const referralLink = referralCode ? `${window.location.origin}/auth?ref=${referralCode}` : null;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("referrals")
      .select("id, credited, reward_usdc")
      .eq("referrer_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setStats({
          total_referrals: data.length,
          credited_referrals: data.filter((r) => r.credited).length,
          total_earned_usdc: data.reduce((sum, r) => sum + (r.reward_usdc ?? 0), 0),
        });
      });
  }, [user]);

  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="border-b border-border px-4 py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Gift className="w-3.5 h-3.5" /> Refer & Earn
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-medium leading-[1.02]">
            Invite people.<br />Earn USDC.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            You earn <span className="text-foreground font-semibold">0.10 USDC</span> for every listing fee paid by someone you refer. No cap. No expiry.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-12 border-b border-border">
        <div className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-6 text-center">
          {[
            { step: "1", icon: <Copy className="w-5 h-5 mx-auto text-primary" />, title: "Copy your link", body: "Share your unique referral link with anyone." },
            { step: "2", icon: <Users className="w-5 h-5 mx-auto text-primary" />, title: "They sign up & list", body: "When they publish their first listing and pay the 0.15 USDC fee, the referral is credited." },
            { step: "3", icon: <TrendingUp className="w-5 h-5 mx-auto text-primary" />, title: "You earn 0.10 USDC", body: "Credited to your wallet on the next payout cycle. No minimum threshold." },
          ].map(({ step, icon, title, body }) => (
            <div key={step} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mx-auto">{step}</div>
              {icon}
              <div className="font-semibold">{title}</div>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Referral link + stats */}
      <section className="px-4 py-14">
        <div className="max-w-lg mx-auto space-y-8">
          {user ? (
            <>
              {/* Link copy card */}
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="font-bold text-lg">Your referral link</h2>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={referralLink ?? ""}
                    className="flex-1 h-10 px-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none truncate"
                  />
                  <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0 h-10 w-10">
                    {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Referral code: <span className="font-mono text-foreground">{referralCode}</span>
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total referred", value: stats.total_referrals },
                  { label: "Credited", value: stats.credited_referrals },
                  { label: "Earned (USDC)", value: stats.total_earned_usdc.toFixed(2) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
                    <div className="text-2xl font-display price-nums text-foreground">{value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Earnings are paid out in USDC to your connected wallet within 7 days of the credited listing fee.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
              <Gift className="w-8 h-8 text-primary mx-auto" />
              <h2 className="font-bold text-lg">Sign in to get your link</h2>
              <p className="text-sm text-muted-foreground">Create an account or sign in to generate your referral link and track your earnings.</p>
              <Button asChild className="w-full"><a href="/auth">Sign in</a></Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Refer;
