import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AdCard } from "@/components/AdCard";
import { supabase } from "@/integrations/supabase/client";
import { AD_CARD_COLUMNS, DbAd, categories, conditions, categoryQueryValues, isPhysicalCategory } from "@/lib/types";
import { Search, SlidersHorizontal, X, MapPin, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/hooks/useSeo";

type SortKey = "newest" | "price_asc" | "price_desc" | "featured";

const Browse = () => {
  useSeo({
    title: "monast.io | Browse Listings",
    description:
      "Search listings across every category and buy safely with USDC escrow on monast.io.",
    canonicalPath: "/browse",
  });

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [ads, setAds] = useState<DbAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let q = supabase.from("ads").select(AD_CARD_COLUMNS).eq("status", "active");

    // Featured-first always, then chosen sort as tiebreaker.
    q = q.order("featured", { ascending: false });
    if (sort === "price_asc") q = q.order("price_usdc", { ascending: true });
    else if (sort === "price_desc") q = q.order("price_usdc", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    if (category) q = q.in("category", categoryQueryValues(category));
    if (condition) q = q.eq("condition", condition);
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    if (location) q = q.ilike("location", `%${location}%`);
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (minPrice && !Number.isNaN(min)) q = q.gte("price_usdc", min);
    if (maxPrice && !Number.isNaN(max)) q = q.lte("price_usdc", max);
    if (featuredOnly || sort === "featured") q = q.eq("featured", true);

    q.limit(60).then(({ data }) => {
      setAds((data as unknown as DbAd[]) || []);
      setLoading(false);
    });
  }, [search, category, condition, location, minPrice, maxPrice, sort, featuredOnly]);

  const activeFilterCount = useMemo(
    () => [category, condition, location, minPrice, maxPrice, featuredOnly].filter(Boolean).length,
    [category, condition, location, minPrice, maxPrice, featuredOnly]
  );

  // Condition and location only apply to physical listings, so those filters
  // stay hidden while a digital category is selected.
  const showPhysicalFilters = !category || isPhysicalCategory(category);

  useEffect(() => {
    if (showPhysicalFilters) return;
    setCondition("");
    setLocation("");
  }, [showPhysicalFilters]);

  const clearAll = () => {
    setSearch(""); setCategory(""); setCondition("");
    setLocation(""); setMinPrice(""); setMaxPrice(""); setFeaturedOnly(false); setSort("newest");
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
        <div className="mb-8"><p className="text-xs text-primary mb-2">Global marketplace</p><h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">The market</h1><p className="text-sm text-muted-foreground">Apps, coins, NFTs, domains, websites and more, transferred fast and paid in USDC escrow.</p></div>
        <div className="flex items-center gap-3 mb-5 lg:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search listings"
              placeholder="Search the market"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="featured">Featured</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>

        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-8 items-start">
        <aside className={`${showFilters ? "block" : "hidden"} lg:block bg-card border border-border rounded-xl p-5 space-y-6 lg:sticky lg:top-24`}>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <div className="flex flex-col gap-1">
                <FilterChip active={!category} onClick={() => setCategory("")}>All</FilterChip>
                {categories.map((c) => (
                  <FilterChip key={c.name} active={category === c.name} onClick={() => setCategory(c.name)}>
                     {c.name}
                  </FilterChip>
                ))}
              </div>
            </div>

            {showPhysicalFilters && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Condition</label>
                <div className="flex flex-col gap-1">
                  <FilterChip active={!condition} onClick={() => setCondition("")}>All</FilterChip>
                  {conditions.map((c) => (
                    <FilterChip key={c} active={condition === c} onClick={() => setCondition(c)}>{c}</FilterChip>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {showPhysicalFilters && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City or country"
                      className="w-full h-9 pl-8 pr-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min price (USDC)</label>
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max price (USDC)</label>
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Any"
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm text-foreground cursor-pointer">
              Featured only
              <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} className="accent-primary" />
            </label>
            {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearAll} className="w-full">Clear all filters</Button>}
        </aside>

        <div className="min-w-0">
          <div className="hidden lg:flex items-center gap-3 mb-5">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="search" aria-label="Search listings" placeholder="Search the market" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" aria-label="Sort"><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="featured">Featured</option></select>
          </div>

        {(activeFilterCount > 0 || search) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {search && <ActiveTag onClear={() => setSearch("")}>Search: {search}</ActiveTag>}
            {category && <ActiveTag onClear={() => setCategory("")}>{category}</ActiveTag>}
            {condition && <ActiveTag onClear={() => setCondition("")}>{condition}</ActiveTag>}
            {location && <ActiveTag onClear={() => setLocation("")}>📍 {location}</ActiveTag>}
            {minPrice && <ActiveTag onClear={() => setMinPrice("")}>≥ {minPrice} USDC</ActiveTag>}
            {maxPrice && <ActiveTag onClear={() => setMaxPrice("")}>≤ {maxPrice} USDC</ActiveTag>}
            {featuredOnly && <ActiveTag onClear={() => setFeaturedOnly(false)}>Featured</ActiveTag>}
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Clear all</button>
          </div>
        )}

        <div className="text-sm text-muted-foreground mb-4">
          {loading ? "Loading market…" : `${ads.length} result${ads.length === 1 ? "" : "s"}`}
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
          {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="space-y-3"><div className="aspect-[4/5] rounded-xl skeleton-shimmer" /><div className="h-4 w-24 rounded skeleton-shimmer" /><div className="h-3 w-4/5 rounded skeleton-shimmer" /></div>) : ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}
        </div>

        {!loading && ads.length === 0 && (
          <div className="text-center py-20 border border-border rounded-xl bg-card mt-4">
            <PackageOpen className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="font-display text-2xl text-foreground mb-2">No listings at this desk.</p>
            <p className="text-sm text-muted-foreground mb-4">Try a broader search or clear your filters.</p>
            <Button variant="outline" onClick={clearAll}>Clear filters</Button>
          </div>
        )}
        </div>
        </div>
      </div>
    </Layout>
  );
};

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
      active ? "bg-accent text-primary border-primary/30" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
    }`}
  >
    {children}
  </button>
);

const ActiveTag = ({ children, onClear }: { children: React.ReactNode; onClear: () => void }) => (
  <button onClick={onClear} className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs">
    {children} <X className="w-3 h-3" />
  </button>
);

export default Browse;
