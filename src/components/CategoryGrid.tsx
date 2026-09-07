import { Link } from "react-router-dom";
import { categories } from "@/lib/types";

export const CategoryGrid = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
      {categories.map((cat) => (
        <Link
          key={cat.name}
          to={`/browse?category=${encodeURIComponent(cat.name)}`}
          className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-card group hover:border-foreground/20 transition-all duration-200"
        >
          <img
            src={cat.image}
            alt={`${cat.name} category`}
            loading="lazy"
            width={512}
            height={512}
            className="absolute inset-0 w-full h-full object-cover scale-110 grayscale opacity-65 mix-blend-luminosity group-hover:scale-[1.14] group-hover:opacity-80 transition-all duration-500"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
          <span className="absolute inset-x-3 bottom-3 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {cat.name}
          </span>
        </Link>
      ))}
    </div>
  );
};
