import { Link } from "react-router-dom";
import { categories } from "@/lib/types";
import { categoryPagePath } from "@/lib/categoryPages";
import { getCategoryAssets } from "@/lib/categoryAssets";

/**
 * CategoryGrid — homepage category cards.
 *
 * Each card shows a mosaic of real logos (coins, NFT art, platform icons)
 * sourced from official public CDNs, with an emoji + name label at the bottom.
 * Falls back gracefully to emoji if any CDN image fails to load.
 */
export const CategoryGrid = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
      {categories.map((cat) => {
        const dedicated = categoryPagePath(cat.name);
        const assets = getCategoryAssets(cat.name).slice(0, 6);

        return (
          <Link
            key={cat.name}
            to={dedicated ?? `/browse?category=${encodeURIComponent(cat.name)}`}
            className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-card group hover:border-primary/50 transition-all duration-200"
          >
            {/* Logo mosaic — 2×3 or 3×2 grid of real brand icons */}
            {assets.length > 0 ? (
              <div className="absolute inset-0 grid grid-cols-3 gap-0.5 p-2">
                {assets.map((asset) => (
                  <div
                    key={asset.name}
                    className="flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm overflow-hidden"
                    title={asset.name}
                  >
                    <img
                      src={asset.imageUrl}
                      alt={asset.name}
                      loading="lazy"
                      className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-110"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        if (el.parentElement) {
                          el.parentElement.textContent = asset.fallbackEmoji;
                          el.parentElement.classList.add(
                            "text-sm",
                            "font-bold",
                            "text-foreground/60",
                          );
                        }
                      }}
                    />
                  </div>
                ))}
                {/* Fill remaining slots if < 6 assets */}
                {Array.from({ length: Math.max(0, 6 - assets.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="rounded-lg bg-background/30" />
                ))}
              </div>
            ) : (
              /* Fallback: large emoji centered */
              <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-30">
                {cat.icon}
              </div>
            )}

            {/* Bottom label */}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-foreground bg-gradient-to-t from-background/90 via-background/60 to-transparent group-hover:text-primary transition-colors">
              <span aria-hidden="true">{cat.icon}</span>
              {cat.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
};
