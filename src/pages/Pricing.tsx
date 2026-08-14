import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { PROMOTION_TIERS } from "@/lib/promotionTiers";
import { Sparkles, Check, Zap, TrendingUp, Bot } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

const Pricing = () => {
  useSeo({
    title: "monast.io | Featured listing pricing",
    description:
      "Boost your listing with a featured slot on monast.io. Transparent USDC pricing, spotlight placement and agent-API priority.",
    canonicalPath: "/pricing",
  });

  const faqs = [
    { q: "How does featuring work?", a: "Your ad gets a Spotlight slot on the home page, a prominent badge, and top placement in browse and search results for the duration of your boost." },
    { q: "What if my ad sells before the boost ends?", a: "The badge stays until the boost expires. Sold ads still appear in Spotlight as social proof for your other listings." },
    { q: "Do agent buyers see featured ads first?", a: "Yes. The Agent API returns featured ads at the top of every listing endpoint, so AI buyers discover them first." },
    { q: "Can I extend a boost?", a: "Yes. Buying another tier on a currently-featured ad adds the new duration on top of the remaining time." },
  ];

  return (
    <Layout>
      <section className="px-4 py-16 md:py-24 bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Featured listings
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Get seen by 10× more buyers
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Promote any ad to the Spotlight on the home page, the top of category pages, and the first slot agents see.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {PROMOTION_TIERS.map((t) => {
            const highlighted = t.id === "7d";
            return (
              <div
                key={t.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  highlighted
                    ? "border-primary bg-card shadow-xl shadow-primary/10 md:scale-105"
                    : "border-border bg-card"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    {t.highlight}
                  </span>
                )}
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t.label}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold font-mono tabular-nums">{t.price}</span>
                  <span className="text-sm font-medium text-muted-foreground">USDC</span>
                </div>
                <div className="text-xs text-muted-foreground mb-5">
                  {t.duration} · {t.perDay.toFixed(2)} USDC/day
                </div>
                <ul className="space-y-2 text-sm text-foreground mb-6 flex-1">
                  {[
                    "Top of home Spotlight",
                    "Top of /browse results",
                    "Featured badge on card",
                    "Priority in Agent API responses",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant={highlighted ? "default" : "outline"} className="w-full">
                  <Link to="/dashboard">Promote an ad</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-4 py-16 bg-card/50 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Why promote?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, title: "Faster sales", body: "Featured ads stay in front of buyers for the whole boost period." },
              { icon: Zap, title: "Top placement", body: "Pinned above organic listings on home, browse, and search." },
              { icon: Bot, title: "Agent priority", body: "AI buyers calling the Agent API see your ad in the first results." },
            ].map((b) => (
              <div key={b.title} className="bg-card rounded-xl border border-border p-5">
                <b.icon className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-card border border-border rounded-xl p-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer flex justify-between items-center font-medium text-foreground">
                  {f.q}
                  <span className="text-primary group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;
