import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DbAd } from "@/lib/types";
import { Sparkles, MapPin } from "lucide-react";

export const Spotlight = () => {
  const [ads, setAds] = useState<DbAd[]>([]);

  useEffect(() => {
    supabase
      .from("ads")
      .select("*")
      .eq("status", "active")
      .eq("featured", true)
      .or(`featured_until.is.null,featured_until.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setAds((data as DbAd[]) || []));
  }, []);

  if (ads.length === 0) return null;

  return (
    <section className="py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Spotlight</h2>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded">
              Promoted
            </span>
          </div>
          <Link to="/pricing" className="text-sm text-primary font-medium hover:underline">
            Promote yours →
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-hide">
          {ads.map((ad) => {
            const cover = ad.images?.[0] || "/placeholder.svg";
            return (
              <Link
                key={ad.id}
                to={`/ad/${ad.id}`}
                className="group snap-start shrink-0 w-[260px] md:w-[300px] rounded-2xl overflow-hidden border border-primary/30 bg-gradient-to-br from-card to-primary/5 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                  <img
                    src={cover}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shadow">
                    <Sparkles className="w-3 h-3" /> Featured
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-lg font-bold text-primary mb-1">
                    {Number(ad.price_usdc).toLocaleString()} USDC
                  </div>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1 mb-1">{ad.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{ad.location}</span>
                    <span className="ml-auto shrink-0">{ad.category}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
