import { Link } from "react-router-dom";
import { DbAd } from "@/lib/types";
import { MapPin } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";


export const AdCard = ({ ad }: { ad: DbAd }) => {
  const cover = ad.images?.[0] || "/placeholder.svg";
  return (
    <Link to={`/ad/${ad.id}`} className="group block">
      <div className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          <img
            src={cover}
            alt={ad.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {ad.featured && (
            <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded">
              Featured
            </span>
          )}
          <span className="absolute top-2 right-2 bg-card/90 backdrop-blur text-xs font-medium px-2 py-0.5 rounded text-foreground">
            {ad.condition}
          </span>
          <FavoriteButton adId={ad.id} className="absolute bottom-2 right-2 z-10" />
          {ad.status === "sold" && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded uppercase tracking-wide">
                Sold
              </span>
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="text-lg font-bold text-primary mb-1">
            {Number(ad.price_usdc).toLocaleString()} USDC
          </div>
          <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2 leading-snug">{ad.title}</h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {ad.location}
            </span>
            <span>{ad.category}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
