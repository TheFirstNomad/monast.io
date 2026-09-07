import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { CategoryGrid } from "@/components/CategoryGrid";
import { AdCard } from "@/components/AdCard";
import { Spotlight } from "@/components/Spotlight";
import { supabase } from "@/integrations/supabase/client";
import { DbAd } from "@/lib/types";
import { ArrowRight, Plus } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";
import marketHero from "@/assets/monast-market-hero.jpg";

const Index = () => {
  useSeo({
    title: "monast.io | Buy & Sell Anything Worldwide with USDC",
    description:
      "Global peer-to-peer marketplace. Post free ads and trade anything worldwide with USDC escrow on Arc.",
    canonicalPath: "/",
  });

  const [ads, setAds] = useState<DbAd[]>([]);

  useEffect(() => {
    supabase
      .from("ads")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setAds((data as DbAd[]) || []));
  }, []);

  const recentAds = ads.slice(0, 8);

  const jsonLdHtml = serializeJsonLdSafe({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://monast.io/#org",
        name: "monast.io",
        url: "https://monast.io/",
        description:
          "Global peer-to-peer marketplace settling every trade in USDC escrow on Arc.",
      },
      {
        "@type": "WebSite",
        "@id": "https://monast.io/#website",
        name: "monast.io",
        url: "https://monast.io/",
        publisher: { "@id": "https://monast.io/#org" },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://monast.io/browse?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  });

  return (
    <Layout>
      {jsonLdHtml && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml }}
        />
      )}

      <section className="relative min-h-[calc(100svh-4rem)] max-h-[860px] overflow-hidden border-b border-border">
        <img src={marketHero} alt="A curated collection of goods available through Monast" width={1600} height={1000} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/10" />
        <div className="relative max-w-7xl mx-auto px-4 min-h-[calc(100svh-4rem)] max-h-[860px] flex flex-col justify-center py-12">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-primary mb-5">The global desk for anything</p>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-medium text-foreground mb-5 leading-[0.98]">
              Buy and sell anything.<br />Worldwide. In USDC.
          </h1>
          <p className="text-base md:text-lg text-foreground/70 mb-8 max-w-xl leading-relaxed">
            List goods, work, or digital products. Payment sits in escrow until delivery is confirmed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="text-base px-7 h-12">
              <Link to="/post-ad">
                <Plus className="w-5 h-5 mr-2" />
                Sell an item
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base px-7 h-12 bg-background/20 backdrop-blur-sm">
              <Link to="/browse">Browse the market <ArrowRight className="ml-1 w-4 h-4" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-0 border-y border-border mt-10 max-w-2xl">
            {[
              ["01", "List", "Describe what you offer."],
              ["02", "Fund escrow", "Buyer locks the payment."],
              ["03", "Release", "Funds move on delivery."],
            ].map(([number, title, body], index) => (
              <div key={title} className={`py-4 pr-3 ${index > 0 ? "pl-4 border-l border-border" : ""}`}>
                <span className="text-[10px] text-primary">{number}</span>
                <div className="text-sm font-semibold text-foreground mt-1">{title}</div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{body}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">Settled on Arc · USDC · Agent-ready</p>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6">
            <div><p className="text-xs text-primary mb-2">Explore the market</p><h2 className="font-display text-3xl md:text-4xl text-foreground">Browse categories</h2></div>
            <Link to="/browse" className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">All categories <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <CategoryGrid />
        </div>
      </section>

      <Spotlight />

      <section className="py-14 md:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-7">
            <div><p className="text-xs text-primary mb-2">Fresh to the desk</p><h2 className="font-display text-3xl md:text-4xl text-foreground">Just listed</h2></div>
            <Link to="/browse" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">View market <ArrowRight className="w-4 h-4" /></Link>
          </div>
          {recentAds.length === 0 ? (
            <div className="relative overflow-hidden text-center py-20 bg-card border border-border rounded-xl">
              <div className="mx-auto mb-5 w-28 aspect-[4/5] border border-border rounded-lg bg-secondary flex items-center justify-center"><Plus className="w-6 h-6 text-muted-foreground" /></div>
              <p className="font-display text-2xl text-foreground mb-2">Be the first listing in this market.</p>
              <p className="text-sm text-muted-foreground mb-5">Open the desk with something worth discovering.</p>
              <Button asChild><Link to="/post-ad">Sell an item</Link></Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              {recentAds.map((ad) => <AdCard key={ad.id} ad={ad} />)}
            </div>
          )}
        </div>
      </section>

      <section className="px-4">
        <div className="max-w-7xl mx-auto border-y border-border py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div><h2 className="font-display text-2xl text-foreground">Agents can search, offer, and pay through the Monast API.</h2><p className="text-sm text-muted-foreground mt-1">A commerce layer built for people and autonomous buyers.</p></div>
          <Button asChild variant="outline"><Link to="/agent-docs">Read agent docs <ArrowRight className="w-4 h-4" /></Link></Button>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
