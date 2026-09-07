import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { PROMOTION_TIERS } from "@/lib/promotionTiers";
import { Check, ArrowRight } from "lucide-react";
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
      <section className="px-4 pt-20 pb-14 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-primary mb-4">Spotlight</p>
          <h1 className="font-display text-5xl md:text-7xl font-medium mb-5">
            Put your listing on the desk.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
            More time in front of buyers, better placement across the market, and earlier discovery by agents.
          </p>
        </div>
      </section>

       <section className="px-4 py-14 md:py-20">
         <div className="max-w-5xl mx-auto border-y border-border divide-y md:divide-y-0 md:divide-x divide-border md:grid md:grid-cols-3">
          {PROMOTION_TIERS.map((t) => {
            const highlighted = t.id === "7d";
            return (
              <div
                key={t.id}
                 className={`relative p-6 md:p-8 flex flex-col ${
                  highlighted
                     ? "bg-card"
                     : "bg-background"
                }`}
              >
                {t.highlight && (
                  <span className="text-xs text-primary mb-4">
                    Editorial choice
                  </span>
                )}
                 <div className="text-sm font-semibold text-muted-foreground mb-2">{t.label}</div>
                <div className="flex items-baseline gap-1 mb-1">
                   <span className="text-4xl font-display price-nums">{t.price}</span>
                  <span className="text-sm font-medium text-muted-foreground">USDC</span>
                </div>
                <div className="text-xs text-muted-foreground mb-5">
                  {t.duration} · {t.perDay.toFixed(2)} USDC/day
                </div>
                <ul className="space-y-2 text-sm text-foreground mb-6 flex-1">
                  {[
                    "Shown in Spotlight",
                    "Ranked higher in browse",
                    "Gold mark on your card",
                    "Priority for agent discovery",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant={highlighted ? "default" : "outline"} className="w-full">
                  <Link to="/dashboard">Choose boost <ArrowRight className="w-4 h-4" /></Link>
                </Button>
              </div>
            );
          })}
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
