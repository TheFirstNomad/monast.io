import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Offer {
  id: string;
  ad_id: string;
  buyer_id: string;
  amount_usdc: number;
  status: string;
  created_at: string;
  ad?: { title: string; price_usdc: number } | null;
  buyer?: { display_name: string | null } | null;
}

export const OffersInbox = () => {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: ads } = await supabase.from("ads").select("id").eq("seller_id", user.id);
    const ids = (ads || []).map((a) => a.id);
    if (!ids.length) { setOffers([]); return; }
    const { data } = await supabase
      .from("offers")
      .select("*, ad:ads!offers_ad_id_fkey(title, price_usdc), buyer:profiles!offers_buyer_id_fkey(display_name)")
      .in("ad_id", ids)
      .order("created_at", { ascending: false });
    setOffers((data as unknown as Offer[]) || []);
  };

  useEffect(() => { load(); }, [user]);

  const respond = async (id: string, status: "accepted" | "rejected") => {
    const { error } = await supabase.from("offers").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Offer ${status}`); load(); }
  };

  if (!offers.length) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-foreground mb-3">Offers Received</h2>
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <Link to={`/ad/${o.ad_id}`} className="text-sm font-medium text-foreground truncate hover:underline block">
                {o.ad?.title || "Ad"}
              </Link>
              <div className="text-xs text-muted-foreground">
                {o.buyer?.display_name || "Buyer"} offered{" "}
                <span className="text-primary font-semibold">{Number(o.amount_usdc).toLocaleString()} USDC</span>
                {o.ad?.price_usdc && <span> (listed {Number(o.ad.price_usdc).toLocaleString()})</span>}
              </div>
            </div>
            {o.status === "pending" ? (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => respond(o.id, "rejected")} className="h-8 px-2">
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={() => respond(o.id, "accepted")} className="h-8 px-2">
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <span className={`text-xs px-2 py-1 rounded capitalize ${
                o.status === "accepted" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              }`}>{o.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
