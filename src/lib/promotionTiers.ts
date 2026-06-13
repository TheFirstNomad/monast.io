// Promotion tier catalog — mirrored in supabase/functions/promote-checkout.
export type PromotionTier = "24h" | "7d" | "30d";

export interface TierConfig {
  id: PromotionTier;
  label: string;
  duration: string;
  price: number; // USDC
  perDay: number;
  highlight?: string;
}

export const PROMOTION_TIERS: TierConfig[] = [
  { id: "24h", label: "Flash", duration: "24 hours", price: 5, perDay: 5 },
  { id: "7d",  label: "Week",  duration: "7 days",   price: 25, perDay: 25 / 7, highlight: "Most popular" },
  { id: "30d", label: "Month", duration: "30 days",  price: 80, perDay: 80 / 30, highlight: "Best value" },
];

// Treasury wallet that receives promotion payments.
// TODO: replace with the real marketplace treasury address before launch.
export const PROMOTION_TREASURY: `0x${string}` =
  "0x000000000000000000000000000000000000dEaD";
