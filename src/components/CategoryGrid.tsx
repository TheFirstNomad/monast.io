import { Link } from "react-router-dom";
import { categories } from "@/lib/types";
import { categoryPagePath } from "@/lib/categoryPages";

export const CategoryGrid = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
      {categories.map((cat) => {
        const dedicated = categoryPagePath(cat.name);
        return (
          <Link
            key={cat.name}
            to={dedicated ?? `/browse?category=${encodeURIComponent(cat.name)}`}
            className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-card group hover:border-primary/50 transition-all duration-200"
          >
            <img
              src={cat.image}
              alt={`${cat.name} category`}
              loading="lazy"
              width={944}
              height={704}
              className="absolute inset-0 w-full h-full object-cover scale-105 saturate-125 group-hover:scale-110 transition-transform duration-500"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <span className="absolute inset-x-3 bottom-3 flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              <span aria-hidden="true">{cat.icon}</span>
              {cat.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
};
