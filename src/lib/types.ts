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

import catVehicles from "@/assets/cat-vehicles.png";
import catProperty from "@/assets/cat-property.png";
import catElectronics from "@/assets/cat-electronics.png";
import catFashion from "@/assets/cat-fashion.png";
import catCrypto from "@/assets/cat-crypto.png";
import catApps from "@/assets/cat-apps.png";
import catServices from "@/assets/cat-services.png";
import catJobs from "@/assets/cat-jobs.png";
import catAgriculture from "@/assets/cat-agriculture.png";
import catOthers from "@/assets/cat-others.png";

export const categories = [
  { name: "Vehicles", icon: "🚗", image: catVehicles },
  { name: "Property", icon: "🏠", image: catProperty },
  { name: "Electronics & Phones", icon: "💻📱", image: catElectronics },
  { name: "Fashion", icon: "👗", image: catFashion },
  { name: "Crypto & NFTs", icon: "🪙", image: catCrypto },
  { name: "Apps", icon: "📲", image: catApps },
  { name: "Services", icon: "🔧", image: catServices },
  { name: "Jobs", icon: "💼", image: catJobs },
  { name: "Agriculture", icon: "🌾", image: catAgriculture },
  { name: "Others", icon: "📦", image: catOthers },
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
