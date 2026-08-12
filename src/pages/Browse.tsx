import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AdCard } from "@/components/AdCard";
import { supabase } from "@/integrations/supabase/client";
import { DbAd, categories, conditions, categoryQueryValues } from "@/lib/types";
import { Search, SlidersHorizontal, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/hooks/useSeo";

type SortKey = "newest" | "price_asc" | "price_desc";

const Browse = () => {
  useSeo({
    title: "Browse listings — monast.io marketplace",
    description:
      "Search thousands of listings across every category and buy safely with USDC escrow on monast.io.",
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
  const [ads, setAds] = useState<DbAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let q = supabase.from("ads").select("*").eq("status", "active");

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

    q.limit(60).then(({ data }) => {
      setAds((data as DbAd[]) || []);
      setLoading(false);
    });
  }, [search, category, condition, location, minPrice, maxPrice, sort]);

  const activeFilterCount = useMemo(
    () => [category, condition, location, minPrice, maxPrice].filter(Boolean).length,
    [category, condition, location, minPrice, maxPrice]
  );

  const clearAll = () => {
    setSearch(""); setCategory(""); setCondition("");
    setLocation(""); setMinPrice(""); setMaxPrice(""); setSort("newest");
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Browse marketplace listings</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Every listing settles in USDC escrow on Arc — funds release only when the buyer confirms.
        </p>
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search listings"
              placeholder="Search ads..."
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
          </select>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>

        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={!category} onClick={() => setCategory("")}>All</FilterChip>
                {categories.map((c) => (
                  <FilterChip key={c.name} active={category === c.name} onClick={() => setCategory(c.name)}>
                    {c.icon} {c.name}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Condition</label>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={!condition} onClick={() => setCondition("")}>All</FilterChip>
                {conditions.map((c) => (
                  <FilterChip key={c} active={condition === c} onClick={() => setCondition(c)}>{c}</FilterChip>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </div>
        )}

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {category && <ActiveTag onClear={() => setCategory("")}>{category}</ActiveTag>}
            {condition && <ActiveTag onClear={() => setCondition("")}>{condition}</ActiveTag>}
            {location && <ActiveTag onClear={() => setLocation("")}>📍 {location}</ActiveTag>}
            {minPrice && <ActiveTag onClear={() => setMinPrice("")}>≥ {minPrice} USDC</ActiveTag>}
            {maxPrice && <ActiveTag onClear={() => setMaxPrice("")}>≤ {maxPrice} USDC</ActiveTag>}
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Clear all</button>
          </div>
        )}

        <div className="text-sm text-muted-foreground mb-4">
          {loading ? "Loading…" : `${ads.length} ad${ads.length === 1 ? "" : "s"} found`}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>

        {!loading && ads.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">No ads match your filters.</p>
            <Button variant="outline" onClick={clearAll}>Clear filters</Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
      active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
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
