import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FavoritesCtx {
  ids: Set<string>;
  isFavorite: (adId: string) => boolean;
  toggle: (adId: string) => Promise<void>;
  count: number;
  loading: boolean;
}

const Ctx = createContext<FavoritesCtx>({
  ids: new Set(),
  isFavorite: () => false,
  toggle: async () => {},
  count: 0,
  loading: false,
});

export const FavoritesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("favorites")
      .select("ad_id")
      .then(({ data }) => {
        if (!active) return;
        setIds(new Set((data ?? []).map((r) => r.ad_id as string)));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const toggle = useCallback(
    async (adId: string) => {
      if (!user) {
        toast.error("Sign in to save items");
        return;
      }
      const saved = ids.has(adId);
      // optimistic
      setIds((prev) => {
        const next = new Set(prev);
        saved ? next.delete(adId) : next.add(adId);
        return next;
      });
      const { error } = saved
        ? await supabase.from("favorites").delete().eq("ad_id", adId).eq("user_id", user.id)
        : await supabase.from("favorites").insert({ ad_id: adId, user_id: user.id });
      if (error) {
        setIds((prev) => {
          const next = new Set(prev);
          saved ? next.add(adId) : next.delete(adId);
          return next;
        });
        toast.error(error.message);
        return;
      }
      toast.success(saved ? "Removed from saved" : "Saved");
    },
    [ids, user],
  );

  const value = useMemo<FavoritesCtx>(
    () => ({ ids, isFavorite: (id: string) => ids.has(id), toggle, count: ids.size, loading }),
    [ids, toggle, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useFavorites = () => useContext(Ctx);
