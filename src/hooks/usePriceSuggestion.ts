import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounced } from "@/hooks/useDebounced";

interface PriceSuggestion {
  min: number;
  max: number;
  median: number;
  count: number;
}

/**
 * Queries recent sold/active listings in the same category with a similar
 * title keyword to produce a price range suggestion for the PostAd form.
 * Returns null when there is not enough data to suggest.
 */
export const usePriceSuggestion = (title: string, category: string): PriceSuggestion | null => {
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null);
  const debouncedTitle = useDebounced(title, 600);

  useEffect(() => {
    if (!category || debouncedTitle.length < 3) {
      setSuggestion(null);
      return;
    }

    // Extract first meaningful word (≥4 chars) as keyword
    const keyword = debouncedTitle.split(/\s+/).find((w) => w.length >= 4) ?? debouncedTitle.slice(0, 6);

    supabase
      .from("ads")
      .select("price_usdc")
      .eq("category", category)
      .in("status", ["active", "sold"])
      .ilike("title", `%${keyword}%`)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data || data.length < 3) {
          setSuggestion(null);
          return;
        }
        const prices = data.map((r) => Number(r.price_usdc)).sort((a, b) => a - b);
        const min = prices[0];
        const max = prices[prices.length - 1];
        const mid = Math.floor(prices.length / 2);
        const median = prices.length % 2 !== 0
          ? prices[mid]
          : (prices[mid - 1] + prices[mid]) / 2;
        setSuggestion({ min, max, median, count: prices.length });
      });
  }, [debouncedTitle, category]);

  return suggestion;
};
