import { Check } from "lucide-react";

/**
 * ListingProgressSteps — 3-step progress indicator for the listing creation funnel.
 * Step 1: Describe your item (PostAd)
 * Step 2: Pay listing fee (PublishAd)
 * Step 3: Your listing is live (AdDetail)
 *
 * Pass `currentStep` as 1, 2, or 3.
 * Additive — no existing component is changed.
 */

const STEPS = [
  { n: 1, label: "Describe" },
  { n: 2, label: "Pay fee" },
  { n: 3, label: "Go live" },
];

interface Props {
  currentStep: 1 | 2 | 3;
}

export const ListingProgressSteps = ({ currentStep }: Props) => (
  <div className="flex items-center gap-0 mb-6">
    {STEPS.map(({ n, label }, i) => {
      const done = n < currentStep;
      const active = n === currentStep;
      return (
        <div key={n} className="flex items-center flex-1 last:flex-none">
          {/* Step circle */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done
                  ? "bg-primary text-background"
                  : active
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : n}
            </div>
            <span
              className={`text-[10px] font-medium whitespace-nowrap ${
                active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
          {/* Connector line between steps */}
          {i < STEPS.length - 1 && (
            <div
              className={`h-px flex-1 mx-2 mt-[-10px] transition-colors ${
                done ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);
