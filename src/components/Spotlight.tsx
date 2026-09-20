import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AD_CARD_COLUMNS, DbAd } from "@/lib/types";
import { Check, MapPin } from "lucide-react";

export const Spotlight = () => {
  const { data: ads = [] } = useQuery({
    queryKey: ["ads", "spotlight"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads")
        .select(AD_CARD_COLUMNS)
        .eq("status", "active")
        .eq("featured", true)
        .or(`featured_until.is.null,featured_until.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(8);
      return (data as unknown as DbAd[]) || [];
    },
  });

  if (ads.length === 0) return null;

  return (
    <section className="py-14 md:py-20 px-4 border-y border-border bg-secondary/25">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-3xl text-foreground">Spotlight</h2>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Check className="w-3.5 h-3.5" /> Promoted</span>
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
                className={`group snap-start shrink-0 overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40 transition-all duration-200 ${ad === ads[0] ? "w-[82vw] sm:w-[520px] md:w-[600px]" : "w-[260px] md:w-[300px]"}`}
              >
                <div className={`relative overflow-hidden bg-secondary ${ad === ads[0] ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
                  <img
                    src={cover}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1 text-xs font-medium text-primary"><Check className="w-3.5 h-3.5" /> Promoted</div>
                </div>
                <div className="p-3">
                   <div className="price-nums whitespace-nowrap text-lg font-semibold text-primary mb-1">
                    {Number(ad.price_usdc).toLocaleString()} USDC
                  </div>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1 mb-1">{ad.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {ad.location && (
                      <>
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{ad.location}</span>
                      </>
                    )}
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
