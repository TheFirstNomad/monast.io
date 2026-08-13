import { Link } from "react-router-dom";
import { categories } from "@/lib/types";

export const CategoryGrid = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {categories.map((cat) => (
        <Link
          key={cat.name}
          to={`/browse?category=${encodeURIComponent(cat.name)}`}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent transition-all group"
        >
          <img
            src={cat.image}
            alt={`${cat.name} category`}
            loading="lazy"
            width={512}
            height={512}
            className="w-12 h-12 object-contain"
          />
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-center">
            {cat.name}
          </span>
        </Link>
      ))}
    </div>
  );
};
