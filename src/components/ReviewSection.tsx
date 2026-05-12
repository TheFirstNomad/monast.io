import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_id: string;
  buyer?: { display_name: string | null } | null;
}

interface Props {
  adId: string;
  sellerId: string;
  adSold: boolean;
}

export const ReviewSection = ({ adId, sellerId, adSold }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*, buyer:profiles!reviews_buyer_id_fkey(display_name)")
      .eq("ad_id", adId)
      .order("created_at", { ascending: false });
    setReviews((data as unknown as Review[]) || []);
  };

  useEffect(() => { load(); }, [adId]);

  const submit = async () => {
    if (!user) { toast.error("Sign in to review"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      ad_id: adId, seller_id: sellerId, buyer_id: user.id, rating, comment: comment || null,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Review submitted"); setComment(""); load(); }
  };

  const canReview = user && user.id !== sellerId && adSold && !reviews.find((r) => r.buyer_id === user.id);

  return (
    <div className="bg-card rounded-xl border border-border p-5 mt-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Reviews ({reviews.length})</h3>

      {canReview && (
        <div className="mb-4 pb-4 border-b border-border">
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} type="button">
                <Star className={`w-5 h-5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            rows={3}
            className="mb-2"
          />
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">{r.buyer?.display_name || "Buyer"}</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3 h-3 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  ))}
                </div>
              </div>
              {r.comment && <p className="text-muted-foreground text-xs">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
