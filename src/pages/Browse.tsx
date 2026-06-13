import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AdCard } from "@/components/AdCard";
import { supabase } from "@/integrations/supabase/client";
import { DbAd, categories, conditions } from "@/lib/types";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const Browse = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [condition, setCondition] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [ads, setAds] = useState<DbAd[]>([]);

  useEffect(() => {
    let q = supabase
      .from("ads")
      .select("*")
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (category) q = q.eq("category", category);
    if (condition) q = q.eq("condition", condition);
    if (search) q = q.ilike("title", `%${search}%`);
    q.limit(60).then(({ data }) => setAds((data as DbAd[]) || []));
  }, [search, category, condition]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search ads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCategory("")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !category ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setCategory(c.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      category === c.name ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Condition</label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setCondition("")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    !condition ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  All
                </button>
                {conditions.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      condition === c ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(category || condition) && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {category && (
              <button onClick={() => setCategory("")} className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs">
                {category} <X className="w-3 h-3" />
              </button>
            )}
            {condition && (
              <button onClick={() => setCondition("")} className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs">
                {condition} <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground mb-4">{ads.length} ads found</div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>

        {ads.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">No ads found matching your criteria</p>
            <Button variant="outline" onClick={() => { setSearch(""); setCategory(""); setCondition(""); }}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Browse;
