import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { CategoryGrid } from "@/components/CategoryGrid";
import { AdCard } from "@/components/AdCard";
import { Spotlight } from "@/components/Spotlight";
import { supabase } from "@/integrations/supabase/client";
import { DbAd } from "@/lib/types";
import { Plus, Shield, Zap, Globe } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

const Index = () => {
  useSeo({
    title: "monast.io — Buy & Sell Anything Worldwide with USDC",
    description:
      "Global peer-to-peer marketplace. Post free ads and trade anything worldwide with USDC escrow on Arc, Base and Tempo.",
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

  return (
    <Layout>
      <section className="hero-gradient py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-4 tracking-tight leading-tight">
            Buy &amp; Sell Anything
            <br />
            <span className="text-primary-foreground/80">Worldwide with USDC on Arc</span>
          </h1>
          <p className="text-base md:text-lg text-primary-foreground/70 mb-8 max-w-xl mx-auto">
            The global marketplace where anyone can post free ads and trade instantly using USDC stablecoin.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="text-base px-8 py-6 font-bold bg-card text-primary hover:bg-card/90">
              <Link to="/post-ad">
                <Plus className="w-5 h-5 mr-2" />
                Post Free Ad
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 font-semibold border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
            >
              <Link to="/browse">Browse Ads</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-8 px-4 border-b border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Shield, label: "Escrow Protected" },
            { icon: Zap, label: "Instant USDC Payments" },
            { icon: Globe, label: "Worldwide Marketplace" },
          ].map((b) => (
            <div key={b.label} className="flex flex-col items-center gap-1.5">
              <b.icon className="w-5 h-5 text-primary" />
              <span className="text-xs md:text-sm font-medium text-muted-foreground">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-6">Browse Categories</h2>
          <CategoryGrid />
        </div>
      </section>

      <Spotlight />


      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Recent Listings</h2>
            <Link to="/browse" className="text-sm text-primary font-medium hover:underline">
              View all →
            </Link>
          </div>
          {recentAds.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground mb-4">No ads yet — be the first to post!</p>
              <Button asChild>
                <Link to="/post-ad">
                  <Plus className="w-4 h-4 mr-2" />
                  Post Free Ad
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentAds.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Index;
