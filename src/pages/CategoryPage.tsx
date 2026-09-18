import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AdCard } from "@/components/AdCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AD_CARD_COLUMNS, DbAd, categories, categoryQueryValues } from "@/lib/types";
import { CATEGORY_PAGES, categoryPageFor } from "@/lib/categoryPages";
import { useSeo } from "@/hooks/useSeo";
import { ArrowRight, PackageOpen, Plus, Search, Sparkles } from "lucide-react";
import NotFound from "./NotFound";

type SortKey = "newest" | "price_asc" | "price_desc";

const accentClasses: Record<string, string> = {
  violet: "from-[hsl(265_85%_60%/0.35)] via-[hsl(230_85%_55%/0.18)]",
  emerald: "from-[hsl(155_75%_45%/0.35)] via-[hsl(185_80%_45%/0.18)]",
  amber: "from-[hsl(35_95%_55%/0.35)] via-[hsl(15_90%_55%/0.18)]",
  sky: "from-[hsl(200_90%_55%/0.35)] via-[hsl(280_85%_60%/0.18)]",
};

const CategoryPage = () => {
  const slug = useLocation().pathname.replace(/^\/+|\/+$/g, "");
  const config = categoryPageFor(slug);

  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [ads, setAds] = useState<DbAd[]>([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: config?.seoTitle ?? "monast.io",
    description: config?.seoDescription ?? "",
    canonicalPath: `/${slug}`,
  });

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    let q = supabase
      .from("ads")
      .select(AD_CARD_COLUMNS)
      .eq("status", "active")
      .in("category", categoryQueryValues(config.category));

    q = q.order("featured", { ascending: false });
    if (sort === "price_asc") q = q.order("price_usdc", { ascending: true });
    else if (sort === "price_desc") q = q.order("price_usdc", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    const terms = [search.trim(), ...quick].filter(Boolean);
    for (const term of terms) {
      q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (minPrice && !Number.isNaN(min)) q = q.gte("price_usdc", min);
    if (maxPrice && !Number.isNaN(max)) q = q.lte("price_usdc", max);

    q.limit(60).then(({ data }) => {
      setAds((data as unknown as DbAd[]) || []);
      setLoading(false);
    });
  }, [config, search, quick, minPrice, maxPrice, sort]);

  const featured = useMemo(() => ads.filter((a) => a.featured).slice(0, 4), [ads]);
  const rest = useMemo(() => ads.filter((a) => !a.featured), [ads]);

  if (!config) return <NotFound />;

  const toggleQuick = (keyword: string) =>
    setQuick((prev) => (prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]));

  const image = categories.find((c) => c.name === config.category)?.image;
  const hasFilters = Boolean(search || quick.length || minPrice || maxPrice);

  return (
    <Layout>
      <section className="relative overflow-hidden border-b border-border">
        {image && (
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}
        <div className={`absolute inset-0 bg-gradient-to-tr to-background/95 ${accentClasses[config.accent]}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
          <p className="text-xs font-medium text-primary mb-3">{config.eyebrow}</p>
          <h1 className="font-display text-4xl md:text-6xl text-foreground mb-4 max-w-3xl leading-[1.02]">
            {config.heading}
          </h1>
          <p className="text-sm md:text-base text-foreground/75 max-w-xl mb-7">{config.subheading}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11">
              <Link to="/post-ad"><Plus className="w-4 h-4 mr-2" />Sell in {config.eyebrow}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 bg-background/30 backdrop-blur-sm">
              <Link to="/browse">All categories <ArrowRight className="ml-1 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <nav aria-label="Digital categories" className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto py-3">
          {CATEGORY_PAGES.map((p) => (
            <Link
              key={p.slug}
              to={`/${p.slug}`}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                p.slug === config.slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.eyebrow}
            </Link>
          ))}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-10 md:py-14 space-y-10">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                aria-label={`Search ${config.eyebrow}`}
                placeholder={`Search ${config.eyebrow.toLowerCase()}`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3">
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min USDC"
                aria-label="Minimum price in USDC"
                className="h-10 w-28 px-3 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max USDC"
                aria-label="Maximum price in USDC"
                className="h-10 w-28 px-3 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort"
                className="h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {config.quickFilters.map((f) => (
              <button
                key={f.keyword}
                onClick={() => toggleQuick(f.keyword)}
                aria-pressed={quick.includes(f.keyword)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  quick.includes(f.keyword)
                    ? "bg-accent text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setQuick([]); setMinPrice(""); setMaxPrice(""); }}
                className="px-3 py-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {featured.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-display text-2xl md:text-3xl text-foreground">Featured {config.eyebrow.toLowerCase()}</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              {featured.map((ad) => <AdCard key={ad.id} ad={ad} />)}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between mb-5">
            <h2 className="font-display text-2xl md:text-3xl text-foreground">All {config.eyebrow.toLowerCase()}</h2>
            <span className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${ads.length} listing${ads.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-[4/5] rounded-xl skeleton-shimmer" />
                    <div className="h-4 w-24 rounded skeleton-shimmer" />
                    <div className="h-3 w-4/5 rounded skeleton-shimmer" />
                  </div>
                ))
              : rest.map((ad) => <AdCard key={ad.id} ad={ad} />)}
          </div>

          {!loading && ads.length === 0 && (
            <div className="text-center py-20 border border-border rounded-xl bg-card">
              <PackageOpen className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
              <p className="font-display text-2xl text-foreground mb-2">Nothing listed here yet.</p>
              <p className="text-sm text-muted-foreground mb-5">Be the first to list in {config.eyebrow}.</p>
              <Button asChild><Link to="/post-ad">Sell an item</Link></Button>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default CategoryPage;
