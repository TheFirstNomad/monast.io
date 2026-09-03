import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { AuthResolving } from "@/components/AuthResolving";
import { EscrowFundButton } from "@/components/EscrowFundButton";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSeo } from "@/hooks/useSeo";
import { supabase } from "@/integrations/supabase/client";
import { ARC_CHAIN_ID } from "@/lib/usdc";
import { ESCROW_STATUS_LABEL, EscrowStatus } from "@/lib/escrow";
import { SALE_FEE_LABEL, DELIVERY_WINDOW_HOURS } from "@/lib/fees";
import { toast } from "sonner";
import { Shield, Loader2, ArrowLeft, CheckCircle2, Lock, Truck } from "lucide-react";

interface AdRow {
  id: string;
  seller_id: string;
  title: string;
  price_usdc: number;
  status: string;
  images: string[] | null;
  location: string | null;
  seller?: { display_name: string | null; rating: number | null } | null;
}

interface EscrowRow {
  id: string;
  amount_usdc: number;
  status: EscrowStatus;
}

/**
 * Buyer checkout: opened from a listing. Creates (or reuses) the escrow for
 * this ad and lets the buyer pay it from their own wallet - self-custody or
 * Circle - then hands off to the escrow tracker.
 */
const Buy = () => {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();
  const { user, resolving } = useRequireAuth();
  const [ad, setAd] = useState<AdRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [escrow, setEscrow] = useState<EscrowRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [autoFund, setAutoFund] = useState(false);

  useSeo({
    title: ad ? `Buy ${ad.title} with USDC escrow | monast.io` : "Secure checkout | monast.io",
    description:
      "Pay with USDC on Arc. Funds stay locked in escrow until you confirm delivery, so neither side has to trust the other.",
    canonicalPath: adId ? `/buy/${adId}` : undefined,
    noindex: true,
  });

  useEffect(() => {
    if (!adId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("id, seller_id, title, price_usdc, status, images, location, seller:profiles!ads_seller_id_fkey(display_name, rating)")
        .eq("id", adId)
        .maybeSingle();
      if (cancelled) return;
      if (error) toast.error(error.message);
      setAd((data as unknown as AdRow) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [adId]);

  // Reuse an escrow the buyer already opened for this listing.
  const loadEscrow = useCallback(async () => {
    if (!adId || !user) return;
    const { data } = await supabase
      .from("escrows")
      .select("id, amount_usdc, status")
      .eq("ad_id", adId)
      .eq("buyer_id", user.id)
      .in("status", ["created", "funded", "disputed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setEscrow((data as EscrowRow) ?? null);
  }, [adId, user]);

  useEffect(() => { void loadEscrow(); }, [loadEscrow]);

  const startEscrow = async () => {
    if (!adId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("escrow-create", {
        body: { ad_id: adId, chain_id: ARC_CHAIN_ID },
      });
      if (error) { toast.error(error.message); return; }
      if (data?.error) { toast.error(data.error); return; }
      const created = data.escrow as EscrowRow;
      setEscrow(created);
      // Hand off straight into the wallet payment so the buyer's USDC actually
      // moves into escrow instead of leaving a pending row behind.
      setAutoFund(true);
      if (created.status !== "created") navigate(`/escrow/${created.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not open escrow");
    } finally {
      setCreating(false);
    }
  };

  if (resolving) return <AuthResolving label="Preparing secure checkout..." />;

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!ad) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Listing not found</h1>
          <Link to="/browse"><Button variant="outline">Browse listings</Button></Link>
        </div>
      </Layout>
    );
  }

  const ownListing = user?.id === ad.seller_id;
  const unavailable = ad.status !== "active" && ad.status !== "reserved";
  const amount = Number(escrow?.amount_usdc ?? ad.price_usdc);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Link to={`/ad/${ad.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to listing
        </Link>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Secure checkout</h1>
          <p className="text-sm text-muted-foreground">
            Pay in USDC on Arc. Your funds stay locked until delivery is confirmed.
          </p>
        </header>

        <section className="bg-card border border-border rounded-xl p-5 flex gap-4">
          <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
            {ad.images?.[0] && (
              <img src={ad.images[0]} alt={ad.title} className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground truncate">{ad.title}</h2>
            <p className="text-xs text-muted-foreground">
              {ad.seller?.display_name || "Anonymous seller"}
              {ad.location ? ` · ${ad.location}` : ""}
            </p>
            <p className="mt-2 text-lg font-bold text-primary">{amount.toLocaleString()} USDC</p>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Item price</span>
            <span className="text-foreground font-medium">{amount.toLocaleString()} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Buyer fee</span>
            <span className="text-foreground font-medium">0 USDC</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <span className="font-semibold text-foreground">You pay</span>
            <span className="font-bold text-primary">{amount.toLocaleString()} USDC</span>
          </div>
          <p className="text-xs text-muted-foreground">
            The seller pays a {SALE_FEE_LABEL} platform fee on release. Nothing is charged to you beyond the item price plus network gas.
          </p>
        </section>

        <section className="bg-card border border-border rounded-xl p-5 space-y-3">
          {ownListing ? (
            <p className="text-sm text-muted-foreground">This is your own listing, so you cannot buy it.</p>
          ) : unavailable ? (
            <p className="text-sm text-muted-foreground">This listing is no longer available for purchase.</p>
          ) : escrow ? (
            escrow.status === "created" ? (
              <>
                <EscrowFundButton
                  escrowId={escrow.id}
                  amount={amount}
                  autoStart={autoFund}
                  onFunded={() => navigate(`/escrow/${escrow.id}`)}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Escrow opened. Pay to lock the funds - you can also finish this later from My purchases.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  {ESCROW_STATUS_LABEL[escrow.status]}
                </div>
                <Link to={`/escrow/${escrow.id}`} className="block">
                  <Button className="w-full gap-2 py-5">
                    <Shield className="w-4 h-4" />
                    Track this escrow
                  </Button>
                </Link>
              </>
            )
          ) : (
            <Button onClick={startEscrow} disabled={creating} className="w-full gap-2 font-semibold py-5">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {creating ? "Opening escrow..." : `Pay ${amount.toLocaleString()} USDC into escrow`}
            </Button>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
          <div className="bg-card border border-border rounded-xl p-4 space-y-1">
            <Lock className="w-4 h-4 text-primary" />
            <p className="font-medium text-foreground">1. Funds locked</p>
            <p>Your USDC moves into escrow, not to the seller.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-1">
            <Truck className="w-4 h-4 text-primary" />
            <p className="font-medium text-foreground">2. Seller ships</p>
            <p>The seller marks delivery once the item is on its way.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-1">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <p className="font-medium text-foreground">3. You confirm</p>
            <p>Release on receipt, or it auto-releases after {DELIVERY_WINDOW_HOURS}h.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Buy;
