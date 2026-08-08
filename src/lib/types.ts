export interface DbAd {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_usdc: number;
  category: string;
  condition: "New" | "Used" | "Refurbished";
  location: string;
  images: string[];
  // `pending_fee` = created but not yet published (listing fee unpaid),
  // `reserved` = an escrow is in flight so it cannot be bought by anyone else.
  status: "pending_fee" | "active" | "reserved" | "sold" | "removed";
  featured: boolean;
  featured_until?: string | null;
  created_at: string;
  seller?: {
    display_name: string | null;
    avatar_url: string | null;
    rating: number | null;
    total_ads: number | null;
    created_at: string;
  } | null;
}

export const categories = [
  { name: "Vehicles", icon: "🚗" },
  { name: "Property", icon: "🏠" },
  { name: "Electronics & Phones", icon: "💻📱" },
  { name: "Fashion", icon: "👗" },
  { name: "Crypto & NFTs", icon: "🪙" },
  { name: "Apps", icon: "📲" },
  { name: "Services", icon: "🔧" },
  { name: "Jobs", icon: "💼" },
  { name: "Agriculture", icon: "🌾" },
  { name: "Others", icon: "📦" },
];

/**
 * Legacy category names that were merged or removed. Listings created before the
 * change keep their old value in the database, so browse queries expand the new
 * name to include its legacy aliases and nothing becomes unreachable.
 */
export const CATEGORY_ALIASES: Record<string, string[]> = {
  "Electronics & Phones": ["Electronics & Phones", "Electronics", "Phones & Tablets"],
  Others: ["Others", "Home & Garden"],
};

export function categoryQueryValues(name: string): string[] {
  return CATEGORY_ALIASES[name] ?? [name];
}


export const conditions = ["New", "Used", "Refurbished"] as const;
