import logoAsset from "@/assets/monast-logo.png.asset.json";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
};

const imageSizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

const nameSizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

export const BrandLogo = ({
  className,
  imageClassName,
  showName = true,
  size = "md",
}: BrandLogoProps) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <img
      src={logoAsset.url}
      alt={showName ? "" : "Monast"}
      aria-hidden={showName || undefined}
      width={128}
      height={128}
      className={cn("shrink-0 object-contain", imageSizes[size], imageClassName)}
    />
    {showName && (
      <span className={cn("font-display leading-none text-foreground", nameSizes[size])}>
        Monast
      </span>
    )}
  </span>
);