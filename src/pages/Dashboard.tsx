import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Package, LogOut, Sparkles, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { useWallet } from "@/hooks/useWallet";
import { isOwnerWallet } from "@/lib/owner";
import { DbAd } from "@/lib/types";
import { OffersInbox } from "@/components/OffersInbox";
import { EscrowsList } from "@/components/EscrowsList";

const Dashboard = () => {
  const { signOut } = useAuth();
  const { user, resolving } = useRequireAuth();
  const { address } = useWallet();

  const navigate = useNavigate();
  const [myAds, setMyAds] = useState<DbAd[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);


  useEffect(() => {
    if (!user) return;
    supabase
      .from("ads")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyAds((data as DbAd[]) || []));
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">
                {(profile?.display_name || user.email || "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-semibold text-foreground">{profile?.display_name || "My Dashboard"}</div>
              <div className="text-sm text-muted-foreground truncate max-w-[220px]">{user.email}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/post-ad">
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Post Ad
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        </div>

        {isOwnerWallet(address) && (
          <div className="bg-card border border-primary/40 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Banknote className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-foreground">Treasury console</div>
              <p className="text-sm text-muted-foreground">
                Create the escrow and revenue wallets, view balances, and withdraw revenue. Payments
                stay disabled until the wallets exist.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/treasury">Open</Link>
            </Button>
          </div>
        )}


        <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-3">
          <Package className="w-5 h-5 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">My Ads</div>
            <div className="text-lg font-bold text-foreground">{myAds.length}</div>
          </div>
        </div>

        <EscrowsList />

        <OffersInbox />

        <h2 className="text-lg font-bold text-foreground mb-4">My Ads</h2>
        {myAds.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <p className="text-muted-foreground mb-4">You haven't posted any ads yet.</p>
            <Button asChild>
              <Link to="/post-ad">
                <Plus className="w-4 h-4 mr-2" />
                Post Your First Ad
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {myAds.map((ad) => (
              <div
                key={ad.id}
                className="flex items-center gap-4 bg-card border border-border rounded-xl p-3"
              >
                <Link to={`/ad/${ad.id}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                  <img
                    src={ad.images?.[0] || "/placeholder.svg"}
                    alt={ad.title}
                    className="w-16 h-16 rounded-lg object-cover bg-secondary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {ad.title}
                    </div>
                    <div className="text-primary font-bold text-sm">
                      {Number(ad.price_usdc).toLocaleString()} USDC
                    </div>
                    <div className="text-xs text-muted-foreground">{ad.location}</div>
                  </div>
                </Link>

                {/* An unpaid listing is invisible to buyers until the fee clears. */}
                {ad.status === "pending_fee" ? (
                  <Link to={`/publish/${ad.id}`} className="shrink-0">
                    <Button size="sm" className="gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Publish
                    </Button>
                  </Link>
                ) : (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded capitalize shrink-0">
                    {ad.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
