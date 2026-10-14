import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { CategoryGrid } from "@/components/CategoryGrid";
import { AdCard } from "@/components/AdCard";
import { Spotlight } from "@/components/Spotlight";
import { supabase } from "@/integrations/supabase/client";
import { AD_CARD_COLUMNS, DbAd } from "@/lib/types";
import { ArrowRight, Globe, Plus, Shield, Zap } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";
import { SITE_TITLE, SITE_DESCRIPTION } from "@/lib/siteMetadata";

const Index = () => {
  useSeo({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    canonicalPath: "/",
  });

  // Cached briefly so returning to the home page is instant.
  const { data: ads = [] } = useQuery({
    queryKey: ["ads", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads")
        .select(AD_CARD_COLUMNS)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data as unknown as DbAd[]) || [];
    },
  });

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

      {/* ── Hero — clean light layout matching the preview ── */}
      <section className="bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 pt-16 pb-12 text-center">
          {/* Live status pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Live on Arc Testnet
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-medium text-foreground leading-[1.05] mb-5">
            The global desk for{" "}
            <span className="text-primary">everything</span>
          </h1>

          {/* Subtext */}
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
            Crypto, NFTs, social accounts, domains, software, services.
            Every trade settles in USDC escrow on Arc. No banks, no borders.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Button asChild size="lg" className="h-12 px-7 text-base font-semibold">
              <Link to="/post-ad">
                List something <ArrowRight className="ml-1.5 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
              <Link to="/browse">Browse the market</Link>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-muted-foreground/60" />
              USDC escrow on every trade
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-muted-foreground/60" />
              Sub-second Arc finality
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-muted-foreground/60" />
              Worldwide, no borders
            </span>
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14 px-4">
        <div className="max-w-7xl mx-auto">
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
