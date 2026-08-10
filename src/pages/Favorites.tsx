import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { AdCard } from "@/components/AdCard";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { useFavorites } from "@/hooks/useFavorites";
import { DbAd } from "@/lib/types";

const Favorites = () => {
  const { user, resolving } = useRequireAuth();
  const { ids } = useFavorites();
  const [ads, setAds] = useState<DbAd[]>([]);
  const [busy, setBusy] = useState(true);


  useEffect(() => {
    if (!user) return;
    const list = Array.from(ids);
    if (list.length === 0) {
      setAds([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    supabase
      .from("ads")
      .select("*")
      .in("id", list)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAds((data as DbAd[]) || []);
        setBusy(false);
      });
  }, [user, ids]);
  if (resolving) return <AuthResolving />;

  return (

    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          Saved items
        </h1>
        <p className="text-sm text-muted-foreground mb-6">Everything you bookmarked across the marketplace.</p>

        {busy ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <p className="text-muted-foreground mb-4">No saved items yet. Tap the heart on any listing.</p>
            <Button asChild>
              <Link to="/browse">Browse the marketplace</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Favorites;
