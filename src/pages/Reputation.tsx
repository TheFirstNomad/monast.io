import { useSeo } from "@/hooks/useSeo";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, BadgeCheck, Copy, Check, ExternalLink, ShieldCheck, TrendingUp, Globe } from "lucide-react";
import { toast } from "sonner";

interface ReputationStats {
  display_name: string | null;
  avatar_url: string | null;
  rating: number | null;
  total_ads: number | null;
  verified: boolean | null;
  created_at: string;
}

interface EscrowStats {
  completed: number;
  disputed: number;
  refunded: number;
}

const Reputation = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ReputationStats | null>(null);
  const [escrowStats, setEscrowStats] = useState<EscrowStats>({ completed: 0, disputed: 0, refunded: 0 });
  const [copied, setCopied] = useState(false);

  useSeo({
    title: "monast.io | My Reputation",
    description: "Your portable onchain reputation score on Monast — verifiable by anyone, anywhere.",
    canonicalPath: "/reputation",
  });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("display_name,avatar_url,rating,total_ads,verified,created_at").eq("id", user.id).maybeSingle(),
      supabase.from("escrows").select("status").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
    ]).then(([{ data: p }, { data: e }]) => {
      if (p) setProfile(p as ReputationStats);
      if (e) {
        const rows = e as Array<{ status: string }>;
        setEscrowStats({
          completed: rows.filter((r) => r.status === "released").length,
          disputed: rows.filter((r) => r.status === "disputed").length,
          refunded: rows.filter((r) => r.status === "refunded").length,
        });
      }
    });
  }, [user]);

  const attestationUrl = user ? `${window.location.origin}/seller/${user.id}` : "";

  const copyAttestation = () => {
    navigator.clipboard.writeText(attestationUrl).catch(() => {});
    setCopied(true);
    toast.success("Reputation link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const scoreColor = (rating: number | null) => {
    if (!rating) return "text-muted-foreground";
    if (rating >= 4.5) return "text-emerald-400";
    if (rating >= 3.5) return "text-yellow-400";
    return "text-red-400";
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="font-display text-3xl mb-3">Your reputation lives onchain</h1>
          <p className="text-muted-foreground mb-6">Sign in to view your portable reputation score and share it with any platform.</p>
          <Button asChild><a href="/auth">Sign in</a></Button>
        </div>
      </Layout>
    );
  }

  const completionRate = escrowStats.completed + escrowStats.refunded > 0
    ? Math.round((escrowStats.completed / (escrowStats.completed + escrowStats.refunded + escrowStats.disputed)) * 100)
    : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-primary mx-auto" />
          <h1 className="font-display text-4xl">Your Monast Reputation</h1>
          <p className="text-muted-foreground">Verifiable by anyone. Portable across platforms. Earned through real trades.</p>
        </div>

        {/* Score card */}
        <Card className="p-6 border-border bg-card">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : (profile?.display_name ?? user.email ?? "?").charAt(0).toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-lg truncate">{profile?.display_name ?? "Anonymous"}</span>
                {profile?.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                    <BadgeCheck className="w-2.5 h-2.5" /> Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-4xl font-display price-nums ${scoreColor(profile?.rating ?? null)}`}>
                {profile?.rating?.toFixed(1) ?? "—"}
              </div>
              <div className="flex items-center justify-end gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`w-3 h-3 ${n <= Math.round(profile?.rating ?? 0) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Listings", value: profile?.total_ads ?? 0, icon: Globe },
            { label: "Completed", value: escrowStats.completed, icon: Check },
            { label: "Disputes", value: escrowStats.disputed, icon: ShieldCheck },
            { label: "Completion rate", value: completionRate !== null ? `${completionRate}%` : "—", icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-4 border-border bg-card text-center">
              <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="text-2xl font-display price-nums text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </Card>
          ))}
        </div>

        {/* Portable attestation */}
        <Card className="p-6 border-border bg-card space-y-4">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Share your reputation</h2>
            <p className="text-sm text-muted-foreground">
              This link is your portable reputation attestation. Share it with clients, platforms, or agents.
              Anyone can verify your trade history and rating without trusting Monast.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={attestationUrl}
              className="flex-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground font-mono truncate focus:outline-none"
            />
            <Button variant="outline" size="icon" onClick={copyAttestation} aria-label="Copy link">
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" asChild aria-label="Open profile">
              <a href={attestationUrl} target="_blank" rel="noopener"><ExternalLink className="w-4 h-4" /></a>
            </Button>
          </div>
        </Card>

        {/* How it works */}
        <Card className="p-6 border-border bg-card space-y-3">
          <h2 className="font-semibold text-foreground">How Monast reputation works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Every completed escrow adds to your trade history — immutably recorded onchain on Arc.",
              "Buyers leave a 1–5 star review after confirmed delivery. Reviews require a verified payment record.",
              "Your rating and trade count are public on your seller profile and via the agent API.",
              "Any platform or agent can verify your score at the URL above — no login, no API key needed.",
              "Disputes and refunds are also recorded. Transparency builds the real trust signal.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <BadgeCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

      </div>
    </Layout>
  );
};

export default Reputation;
