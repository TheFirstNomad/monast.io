import { Link } from "react-router-dom";
import { DbAd } from "@/lib/types";
import { MapPin } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";


export const AdCard = ({ ad }: { ad: DbAd }) => {
  const cover = ad.images?.[0] || "/placeholder.svg";
  return (
    <Link to={`/ad/${ad.id}`} className="group block h-full">
      <article className="h-full bg-card rounded-xl border border-border overflow-hidden transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/20 market-shadow">
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
          <img
            src={cover}
            alt={ad.title}
            className={`w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03] ${ad.status === "sold" ? "grayscale opacity-50" : ""}`}
            loading="lazy"
          />
          {ad.featured && (
            <span className="absolute top-0 left-0 w-8 h-8 overflow-hidden" aria-label="Featured listing">
              <span className="absolute top-1 left-[-12px] w-12 h-px rotate-[-45deg] bg-primary" />
            </span>
          )}
          <FavoriteButton adId={ad.id} className="absolute bottom-2 right-2 z-10" />
          {ad.status === "sold" && (
            <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Sold</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="price-nums whitespace-nowrap text-lg font-semibold text-primary mb-1.5">
            {Number(ad.price_usdc).toLocaleString()} USDC
          </div>
          <h3 className="text-sm font-medium text-foreground line-clamp-2 min-h-10 mb-3 leading-snug">{ad.title}</h3>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {ad.location}
            </span>
            <span aria-hidden="true">·</span><span>{ad.condition}</span><span aria-hidden="true">·</span><span className="truncate">{ad.category}</span>
          </div>
        </div>
      </article>
    </Link>
  );
};
