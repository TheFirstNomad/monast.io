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
  status: "active" | "sold" | "removed";
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
  { name: "Electronics", icon: "💻" },
  { name: "Fashion", icon: "👗" },
  { name: "Phones & Tablets", icon: "📱" },
  { name: "Home & Garden", icon: "🌿" },
  { name: "Services", icon: "🔧" },
  { name: "Jobs", icon: "💼" },
  { name: "Agriculture", icon: "🌾" },
  { name: "Others", icon: "📦" },
];

export const conditions = ["New", "Used", "Refurbished"] as const;
