/**
 * Columns a listing card needs. Lists ask for exactly these instead of every
 * column, so long descriptions never travel to the browser for a grid view.
 */
export const AD_CARD_COLUMNS =
  "id,seller_id,title,price_usdc,category,condition,location,images,status,featured,featured_until,created_at";

export interface DbAd {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_usdc: number;
  category: string;
  // Digital listings (domains, apps, tokens) have no physical condition or
  // location, so both are optional.
  condition?: "New" | "Used" | "Refurbished" | null;
  location?: string | null;
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

import catCrypto from "@/assets/cat-crypto.jpg";
import catApps from "@/assets/cat-apps.jpg";
import catNfts from "@/assets/cat-nfts.jpg";
import catDomains from "@/assets/cat-domains.jpg";
import catWebsites from "@/assets/cat-websites.jpg";
import catSocial from "@/assets/cat-social.jpg";
import catDigitalProducts from "@/assets/cat-digital-products.jpg";
import catServices from "@/assets/cat-services.jpg";
import catOthers from "@/assets/cat-others.jpg";

export interface Category {
  name: string;
  icon: string;
  image: string;
  /** Digital assets transfer online: no condition or location is collected. */
  digital: boolean;
}

export const categories: Category[] = [
  { name: "Apps", icon: "📲", image: catApps, digital: true },
  { name: "Crypto & Coins", icon: "🪙", image: catCrypto, digital: true },
  { name: "NFTs", icon: "🖼️", image: catNfts, digital: true },
  { name: "Domains", icon: "🌐", image: catDomains, digital: true },
  { name: "Websites", icon: "🖥️", image: catWebsites, digital: true },
  { name: "Social & Media Accounts", icon: "📣", image: catSocial, digital: true },
  { name: "Digital Products", icon: "📁", image: catDigitalProducts, digital: true },
  { name: "Services", icon: "🔧", image: catServices, digital: true },
  { name: "Others", icon: "📦", image: catOthers, digital: false },
];

export const DIGITAL_CATEGORIES = categories.filter((c) => c.digital).map((c) => c.name);

/** True when a category needs condition + location fields (physical goods). */
export function isPhysicalCategory(name: string): boolean {
  const hit = categories.find((c) => c.name === name);
  // Unknown/legacy category names came from the old physical set.
  return hit ? !hit.digital : true;
}

/**
 * Legacy category names that were merged or removed. Listings created before the
 * change keep their old value in the database, so browse queries expand the new
 * name to include its legacy aliases and nothing becomes unreachable.
 */
export const CATEGORY_ALIASES: Record<string, string[]> = {
  "Crypto & Coins": ["Crypto & Coins", "Crypto & NFTs"],
  NFTs: ["NFTs", "Crypto & NFTs"],
  Others: [
    "Others",
    "Home & Garden",
    "Vehicles",
    "Property",
    "Electronics & Phones",
    "Electronics",
    "Phones & Tablets",
    "Fashion",
    "Jobs",
    "Agriculture",
  ],
};

export function categoryQueryValues(name: string): string[] {
  return CATEGORY_ALIASES[name] ?? [name];
}


export const conditions = ["New", "Used", "Refurbished"] as const;
