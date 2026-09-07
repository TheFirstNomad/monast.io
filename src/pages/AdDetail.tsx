import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { attributeLabel } from "@/lib/categoryFields";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DbAd } from "@/lib/types";
import { MapPin, MessageCircle, Shield, ChevronLeft, ChevronRight, Star, CheckCircle2, Sparkles, Pencil, Trash2, LockKeyhole, PackageCheck, Banknote } from "lucide-react";
import { ChatDialog } from "@/components/ChatDialog";
import { OfferDialog } from "@/components/OfferDialog";
import { Shield as ShieldIcon } from "lucide-react";
import { ReviewSection } from "@/components/ReviewSection";
import { toast } from "sonner";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ReportDialog } from "@/components/ReportDialog";

const AdDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [ad, setAd] = useState<DbAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  // An open escrow means buyer funds are still locked for this ad - the seller
  // must not be able to close the listing out from under them.
  const OPEN_ESCROW_STATUSES = ["created", "funded", "disputed"];
  const [openEscrowId, setOpenEscrowId] = useState<string | null>(null);

  const markSold = async () => {
    if (!ad) return;
    setMarking(true);
    // Re-check at click time so a stale page can't slip through.
    const { data: live } = await supabase
      .from("escrows")
      .select("id")
      .eq("ad_id", ad.id)
      .in("status", OPEN_ESCROW_STATUSES)
      .limit(1)
      .maybeSingle();
    if (live) {
      setOpenEscrowId(live.id);
      setMarking(false);
      toast.error("Cannot mark as sold while an active escrow exists");
      return;
    }
    const { error } = await supabase
      .from("ads")
      .update({ status: "sold", sold_at: new Date().toISOString() })
      .eq("id", ad.id);
    setMarking(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked as sold");
      setAd({ ...ad, status: "sold" });
    }
  };

  const [removing, setRemoving] = useState(false);

  const removeListing = async () => {
    if (!ad) return;
    setRemoving(true);
    // Re-check at click time so a stale page can't slip through.
    const { data: live } = await supabase
      .from("escrows")
      .select("id")
      .eq("ad_id", ad.id)
      .in("status", OPEN_ESCROW_STATUSES)
      .limit(1)
      .maybeSingle();
    if (live) {
      setOpenEscrowId(live.id);
      setRemoving(false);
      toast.error("Cannot remove this listing while an active escrow exists");
      return;
    }
    const { error } = await supabase
      .from("ads")
      .update({ status: "removed" })
      .eq("id", ad.id);
    setRemoving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Listing removed");
      setAd({ ...ad, status: "removed" });
    }
  };

  useEffect(() => {
    if (!id) return;
    supabase
      .from("ads")
      .select("*, seller:profiles!ads_seller_id_fkey(display_name, avatar_url, rating, total_ads, created_at)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setAd(data as unknown as DbAd);
        setLoading(false);
      });
  }, [id]);

  // Does this ad have an escrow still in flight?
  useEffect(() => {
    if (!id || !user) return;
    supabase
      .from("escrows")
      .select("id")
      .eq("ad_id", id)
      .in("status", OPEN_ESCROW_STATUSES)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setOpenEscrowId(data?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  if (!ad) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Ad Not Found</h1>
          <Link to="/" className="text-primary hover:underline">Back to Home</Link>
        </div>
      </Layout>
    );
  }

  const images = ad.images?.length ? ad.images : ["/placeholder.svg"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: ad.title,
    description: ad.description,
    image: images,
    category: ad.category,
    offers: {
      "@type": "Offer",
      priceCurrency: "USDC",
      price: Number(ad.price_usdc),
      availability: ad.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      url: typeof window !== "undefined" ? window.location.href : undefined,
    },
  };

  const jsonLdHtml = serializeJsonLdSafe(jsonLd);

  return (
    <Layout>
      {jsonLdHtml && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml }}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to={`/browse?category=${encodeURIComponent(ad.category)}`} className="hover:text-foreground">
            {ad.category}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{ad.title}</span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-8 lg:gap-12 items-start">
          <div>
            <button type="button" onClick={() => window.open(images[currentImage], "_blank", "noopener,noreferrer")} className="relative block w-full aspect-[4/3] rounded-xl overflow-hidden bg-secondary mb-3 cursor-zoom-in" aria-label="Open full-size image">
              <img src={images[currentImage]} alt={ad.title} className="w-full h-full object-cover" />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImage((currentImage - 1 + images.length) % images.length)}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-card/80 backdrop-blur rounded-full flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentImage((currentImage + 1) % images.length)}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-card/80 backdrop-blur rounded-full flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              <div className="absolute bottom-2 right-2 bg-card/80 backdrop-blur text-xs px-2 py-1 rounded">
                {currentImage + 1}/{images.length}
              </div>
            </button>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    aria-label={`Show photo ${i + 1}`}
                    className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 ${
                      i === currentImage ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-10 border-t border-border pt-8">
              <h2 className="font-display text-2xl text-foreground mb-4">Description</h2>
              <p className="text-foreground/70 text-base leading-7 whitespace-pre-line max-w-3xl">{ad.description}</p>
            </div>

            {Object.entries((ad as any).attributes ?? {}).filter(([, v]) => v).length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-foreground mb-3">Details</h2>
                <dl className="space-y-3">
                  {Object.entries((ad as any).attributes as Record<string, string>)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {attributeLabel(k)}
                        </dt>
                        <dd className="text-sm text-foreground whitespace-pre-line break-words">{v}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-card rounded-xl border border-border p-6 market-shadow">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="text-3xl price-nums font-semibold text-primary whitespace-nowrap">
                  {Number(ad.price_usdc).toLocaleString()} USDC
                </div>
                <FavoriteButton adId={ad.id} size="lg" />
              </div>
              <h1 className="font-display text-2xl text-foreground mb-4 leading-tight">{ad.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
                  <MapPin className="w-3 h-3" />
                  {ad.location}
                </span>
                <span className="bg-secondary px-2 py-1 rounded">{ad.condition}</span>
                <span className="bg-secondary px-2 py-1 rounded">{ad.category}</span>
                {user && user.id !== ad.seller_id && (
                  <ReportDialog targetType="ad" targetId={ad.id} className="ml-auto" />
                )}
              </div>
              <div className="border-t border-border mt-5 pt-5">
                <p className="text-xs font-semibold text-foreground mb-3">Payment protection</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[{ icon: LockKeyhole, label: "Authorized" }, { icon: Shield, label: "In escrow" }, { icon: Banknote, label: "Released" }].map(({ icon: Icon, label }, i) => <div key={label} className="relative"><Icon className={`w-4 h-4 mx-auto mb-1 ${i === 1 ? "text-success" : "text-primary"}`} /><span className="text-[10px] text-muted-foreground">{label}</span></div>)}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-3">Your payment stays protected until you confirm delivery.</p>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              {ad.status === "removed" ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-secondary rounded-lg text-sm font-semibold text-muted-foreground">
                  <Trash2 className="w-4 h-4" />
                  This listing has been removed
                </div>
              ) : ad.status === "sold" ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-secondary rounded-lg text-sm font-semibold text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  This item has been sold
                </div>
              ) : user && user.id === ad.seller_id ? (
                <>
                  <Link to={`/edit-ad/${ad.id}`} className="block">
                    <Button variant="outline" className="w-full gap-2 py-5">
                      <Pencil className="w-4 h-4" />
                       Edit listing
                    </Button>
                  </Link>
                  {openEscrowId && (
                    <p className="text-xs text-muted-foreground text-center">
                      Item name and price are locked while an active escrow exists.
                    </p>
                  )}
                  <Button
                    onClick={markSold}
                    disabled={marking || !!openEscrowId}
                    className="w-full gap-2 font-semibold py-5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                     {marking ? "Marking..." : "Mark as sold"}
                  </Button>
                  {openEscrowId && (
                    <p className="text-xs text-muted-foreground text-center">
                      Cannot mark as sold while an active escrow exists.{" "}
                      <Link to={`/escrow/${openEscrowId}`} className="text-primary hover:underline">
                        View escrow
                      </Link>
                    </p>
                  )}
                  <Button
                    onClick={removeListing}
                    disabled={removing || !!openEscrowId}
                    variant="outline"
                    className="w-full gap-2 py-5 border-destructive/40 text-destructive hover:bg-destructive/5"
                  >
                    <Trash2 className="w-4 h-4" />
                    {removing ? "Removing..." : "Remove listing"}
                  </Button>
                  <Link to={`/promote/${ad.id}`} className="block">
                    <Button variant="outline" className="w-full gap-2 py-5 border-primary/40 text-primary hover:bg-primary/5">
                      <Sparkles className="w-4 h-4" />
                       {ad.featured ? "Extend Spotlight" : "Promote to Spotlight"}
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to={`/buy/${ad.id}`} className="block">
                    <Button className="w-full gap-2 font-semibold py-5">
                      <ShieldIcon className="w-4 h-4" />
                      Buy with escrow
                    </Button>
                  </Link>
                   <Button variant="outline" className="w-full gap-2 py-5" onClick={() => setOfferOpen(true)}>
                    <Shield className="w-4 h-4" />
                     Make offer
                   </Button>
                   <Button variant="ghost" className="w-full gap-2 py-5" onClick={() => setChatOpen(true)}>
                     <MessageCircle className="w-4 h-4" />
                     Message seller
                  </Button>
                </>
              )}
            </div>

            {ad.seller && (
              <Link
                to={`/seller/${ad.seller_id}`}
                className="block bg-card rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
              >
                 <h3 className="text-xs font-semibold text-muted-foreground mb-3">Seller</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">
                      {(ad.seller.display_name || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {ad.seller.display_name || "Anonymous"}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="w-3 h-3 fill-primary text-primary" />
                       {ad.seller.rating ?? "-"} rating · {ad.seller.total_ads ?? 0} completed trades
                    </div>
                  </div>
                </div>
                 <div className="text-xs text-muted-foreground border-t border-border pt-3 flex justify-between">
                   <span>
                  Member since{" "}
                  {new Date(ad.seller.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                   </span><span className="text-primary">View shop</span>
                </div>
              </Link>
            )}

            <ReviewSection adId={ad.id} sellerId={ad.seller_id} adSold={ad.status === "sold"} />
          </div>
        </div>
        <div className="mt-12 border-y border-border py-7">
          <div className="grid grid-cols-3 max-w-xl mx-auto">
            {[{ icon: LockKeyhole, title: "Paid" }, { icon: PackageCheck, title: "Delivered" }, { icon: CheckCircle2, title: "Released" }].map(({ icon: Icon, title }, i) => <div key={title} className={`text-center ${i > 0 ? "border-l border-border" : ""}`}><Icon className="w-4 h-4 text-primary mx-auto mb-2" /><p className="text-xs font-medium text-foreground">{title}</p></div>)}
          </div>
        </div>
      </div>
      <ChatDialog open={chatOpen} onOpenChange={setChatOpen} adId={ad.id} sellerId={ad.seller_id} adTitle={ad.title} />
      <OfferDialog open={offerOpen} onOpenChange={setOfferOpen} adId={ad.id} listPrice={Number(ad.price_usdc)} />
    </Layout>
  );
};

export default AdDetail;
