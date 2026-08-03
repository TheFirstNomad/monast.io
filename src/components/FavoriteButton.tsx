import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";

export const FavoriteButton = ({
  adId,
  className,
  size = "sm",
}: {
  adId: string;
  className?: string;
  size?: "sm" | "lg";
}) => {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(adId);
  const dim = size === "lg" ? "w-5 h-5" : "w-4 h-4";

  return (
    <button
      type="button"
      aria-label={active ? "Remove from saved items" : "Save item"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(adId);
      }}
      className={cn(
        "rounded-full bg-card/90 backdrop-blur border border-border flex items-center justify-center transition-colors hover:border-primary/60",
        size === "lg" ? "w-10 h-10" : "w-8 h-8",
        className,
      )}
    >
      <Heart className={cn(dim, active ? "fill-primary text-primary" : "text-muted-foreground")} />
    </button>
  );
};
