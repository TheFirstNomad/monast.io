import { Link } from "react-router-dom";
import { DbAd } from "@/lib/types";
import { MapPin } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ProSellerBadge } from "@/components/ProSellerBadge";

/* Generates a deterministic hue from a string for avatar backgrounds */
const avatarHue = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

export const AdCard = ({ ad }: { ad: DbAd }) => {
  const cover = ad.images?.[0] || "/placeholder.svg";
  const isSold = ad.status === "sold";

  return (
    <Link to={`/ad/${ad.id}`} className="group block h-full">
      <article className="h-full bg-card rounded-2xl border border-border overflow-hidden card-hover">

        {/* Cover image */}
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
          <img
            src={cover}
            alt={ad.title}
            className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025] ${isSold ? "grayscale opacity-40" : ""}`}
            loading="lazy"
          />

          {/* Featured corner pip */}
          {ad.featured && !isSold && (
            <span
              className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
              aria-label="Featured listing"
            >
              Featured
            </span>
          )}

          <FavoriteButton adId={ad.id} className="absolute bottom-2 right-2 z-10" />

          {/* Sold overlay */}
          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background/90 backdrop-blur-sm text-foreground text-xs font-semibold px-3 py-1.5 rounded-full border border-border">
                Sold
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3.5">
          {/* Title first — dominates */}
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-1.5">
            {ad.title}
          </h3>

          {/* Price secondary — smaller, muted context */}
          <div className="price-nums text-xs font-medium text-muted-foreground mb-2">
            {Number(ad.price_usdc).toLocaleString()} USDC
          </div>

          {/* Badges */}
          {(ad.seller?.verified || (ad.seller?.pro_until && new Date(ad.seller.pro_until) > new Date())) && (
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {ad.seller?.verified && <VerifiedBadge />}
              {ad.seller?.pro_until && new Date(ad.seller.pro_until) > new Date() && <ProSellerBadge />}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
            {ad.location && (
              <>
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  {ad.location}
                </span>
                <span aria-hidden="true" className="opacity-40">·</span>
              </>
            )}
            {ad.condition && (
              <>
                <span>{ad.condition}</span>
                <span aria-hidden="true" className="opacity-40">·</span>
              </>
            )}
            <span className="truncate">{ad.category}</span>
          </div>
        </div>
      </article>
    </Link>
  );
};

/* Standalone avatar — used in seller cards and message threads */
export const SellerAvatar = ({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) => {
  const hue = avatarHue(name || "U");
  const initial = (name || "U").charAt(0).toUpperCase();
  const dim = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold shrink-0 select-none`}
      style={{
        background: `hsl(${hue} 55% 92%)`,
        color: `hsl(${hue} 55% 32%)`,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
};
