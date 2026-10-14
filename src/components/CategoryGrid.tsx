import { Link } from "react-router-dom";
import { categories } from "@/lib/types";
import { categoryPagePath } from "@/lib/categoryPages";
import { getCategoryAssets } from "@/lib/categoryAssets";

/**
 * CategoryGrid — homepage category showcase.
 *
 * Matches the preview: individual logo icons in a flex-wrap row, each in a
 * white circle with a name label beneath. Card bottom shows the category
 * title + arrow + grey subtitle. White card, light border, rounded-2xl.
 */

const CATEGORY_SUBTITLES: Record<string, string> = {
  "Crypto & Coins":         "BTC, ETH, BNB, SOL, USDC and more",
  "NFTs":                   "CryptoPunks, BAYC, Azuki, Pudgy Penguins",
  "Social & Media Accounts":"X, TikTok, Instagram, YouTube, Telegram",
  "Apps":                   "Figma, Notion, Canva, Adobe and more",
  "Domains":                "ENS, Unstoppable, GoDaddy and more",
  "Websites":               "WordPress, Webflow, Shopify and more",
  "Digital Products":       "Templates, eBooks, courses and more",
  "Services":               "Design, dev, writing, marketing",
  "Others":                 "Everything else worth trading",
};

export const CategoryGrid = () => {
  // Show the 3 hero categories prominently, rest in a smaller second row
  const heroCategories = categories.slice(0, 3);
  const restCategories = categories.slice(3);

  return (
    <div className="space-y-4">
      {/* Hero row — 3 large cards matching the preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {heroCategories.map((cat) => (
          <CategoryCard key={cat.name} cat={cat} large />
        ))}
      </div>

      {/* Secondary row — remaining categories, smaller */}
      {restCategories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {restCategories.map((cat) => (
            <CategoryCard key={cat.name} cat={cat} large={false} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Single category card ─────────────────────────────────────────────── */

interface CategoryCardProps {
  cat: { name: string; icon: string };
  large: boolean;
}

const CategoryCard = ({ cat, large }: CategoryCardProps) => {
  const dedicated = categoryPagePath(cat.name);
  const href = dedicated ?? `/browse?category=${encodeURIComponent(cat.name)}`;
  // Show up to 5 icons for large cards, 4 for small
  const assets = getCategoryAssets(cat.name).slice(0, large ? 5 : 4);
  const subtitle = CATEGORY_SUBTITLES[cat.name] ?? "";

  return (
    <Link
      to={href}
      className={[
        "group flex flex-col justify-between",
        "bg-white dark:bg-card",
        "border border-border rounded-2xl",
        "transition-all duration-200 hover:shadow-md hover:border-primary/30",
        large ? "p-5 min-h-[180px]" : "p-3.5 min-h-[130px]",
      ].join(" ")}
    >
      {/* Logo icon row */}
      <div className="flex flex-wrap gap-2 mb-3">
        {assets.map((asset) => (
          <div key={asset.name} className="flex flex-col items-center gap-1">
            {/* White circle — no border in light mode (card already has one), subtle border in dark */}
            <div
              className={[
                "flex items-center justify-center rounded-full overflow-hidden",
                "bg-secondary dark:bg-muted",
                "dark:border dark:border-border",
                "transition-transform duration-200 group-hover:scale-105",
                large ? "w-12 h-12" : "w-9 h-9",
              ].join(" ")}
            >
              <img
                src={asset.imageUrl}
                alt={asset.name}
                loading="lazy"
                className={large ? "w-7 h-7 object-contain" : "w-5 h-5 object-contain"}
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  if (el.parentElement) {
                    el.parentElement.textContent = asset.fallbackEmoji;
                    el.parentElement.classList.add("text-lg");
                  }
                }}
              />
            </div>
            {/* Name label — truncated */}
            {large && (
              <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[52px] truncate">
                {asset.name}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom: category title + subtitle */}
      <div>
        <div className="flex items-center gap-1">
          <span
            className={[
              "font-semibold text-foreground group-hover:text-primary transition-colors",
              large ? "text-sm" : "text-xs",
            ].join(" ")}
          >
            {cat.name}
          </span>
          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs">→</span>
        </div>
        {large && subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>
    </Link>
  );
};
