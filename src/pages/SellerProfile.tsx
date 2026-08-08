import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { AdCard } from "@/components/AdCard";
import { ReportDialog } from "@/components/ReportDialog";
import { DbAd } from "@/lib/types";
import { Star } from "lucide-react";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  rating: number | null;
  total_ads: number | null;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer?: { display_name: string | null } | null;
}

const SellerProfile = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ads, setAds] = useState<DbAd[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: a }, { data: r }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url, bio, rating, total_ads, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("ads").select("*").eq("seller_id", id).eq("status", "active").order("created_at", { ascending: false }),
        supabase
          .from("reviews")
          .select("*, buyer:profiles!reviews_buyer_id_fkey(display_name)")
          .eq("seller_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      setProfile(p as Profile);
      setAds((a as DbAd[]) || []);
      setReviews((r as unknown as Review[]) || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Seller Not Found</h1>
          <Link to="/" className="text-primary hover:underline">Back to Home</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-xl p-6 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-2xl">
              {(profile.display_name || "U").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{profile.display_name || "Anonymous"}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-primary text-primary" />
                {profile.rating ?? "—"}
              </span>
              <span>·</span>
              <span>{profile.total_ads ?? ads.length} ads</span>
              <span>·</span>
              <span>
                Member since{" "}
                {new Date(profile.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            {profile.bio && <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>}
            <div className="mt-2">
              <ReportDialog targetType="profile" targetId={profile.id} variant="ghost" label="Report seller" />
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-foreground mb-3">Active Listings ({ads.length})</h2>
        {ads.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-xl text-sm text-muted-foreground mb-6">
            No active listings.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}

        <h2 className="text-lg font-bold text-foreground mb-3">Reviews ({reviews.length})</h2>
        {reviews.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-xl text-sm text-muted-foreground">
            No reviews yet.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground text-sm">
                    {r.buyer?.display_name || "Buyer"}
                  </span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-3 h-3 ${
                          n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SellerProfile;
