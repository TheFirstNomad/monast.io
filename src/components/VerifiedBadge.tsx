import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  className?: string;
  size?: "sm" | "md";
}

/**
 * Verified Seller badge — shown when profiles.verified = true.
 * Verification is granted by admins via the AdminRoles panel.
 */
export const VerifiedBadge = ({ className, size = "sm" }: VerifiedBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 font-semibold rounded-full",
      "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400",
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
      className,
    )}
  >
    <BadgeCheck className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
    Verified
  </span>
);
