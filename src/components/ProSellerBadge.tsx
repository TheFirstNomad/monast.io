import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProSellerBadgeProps {
  className?: string;
  size?: "sm" | "md";
}

/**
 * Pro Seller badge — shown on AdCard, AdDetail, and SellerProfile for users
 * with an active pro_subscriptions row.
 */
export const ProSellerBadge = ({ className, size = "sm" }: ProSellerBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 font-semibold rounded-full",
      "bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border border-violet-500/30 text-violet-300",
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
      className,
    )}
  >
    <Sparkles className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
    Pro Seller
  </span>
);
