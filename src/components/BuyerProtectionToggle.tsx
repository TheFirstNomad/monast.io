import { useState } from "react";
import { ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuyerProtectionToggleProps {
  priceUsdc: number;
  onChange: (enabled: boolean, feeUsdc: number) => void;
  className?: string;
}

const PROTECTION_BPS = 50; // 0.5%
const MIN_FEE = 0.05; // 0.05 USDC minimum

/**
 * Optional buyer protection upsell shown on the escrow/buy flow.
 * If the buyer opts in, an extra 0.5% is added to the escrow amount.
 * The extra amount feeds the Monast protection reserve.
 */
export const BuyerProtectionToggle = ({ priceUsdc, onChange, className }: BuyerProtectionToggleProps) => {
  const [enabled, setEnabled] = useState(false);

  const fee = Math.max(MIN_FEE, Math.round(priceUsdc * PROTECTION_BPS) / 10_000);
  const feeLabel = fee.toFixed(2);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    onChange(next, next ? fee : 0);
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors cursor-pointer select-none",
        enabled
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-foreground/20",
        className,
      )}
      role="checkbox"
      aria-checked={enabled}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => e.key === " " && toggle()}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={cn(
          "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          enabled ? "border-primary bg-primary" : "border-border bg-transparent",
        )}>
          {enabled && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className={cn("w-4 h-4 shrink-0", enabled ? "text-primary" : "text-muted-foreground")} />
            <span className="font-semibold text-sm text-foreground">Buyer Protection</span>
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              enabled ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground",
            )}>
              +{feeLabel} USDC
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            If the seller disappears and Monast confirms non-delivery after arbitration, you get a full refund from the protection reserve — guaranteed, even if the seller has no funds.
          </p>
        </div>
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 hidden sm:block" />
      </div>
    </div>
  );
};
