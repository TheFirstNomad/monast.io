import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DbAd } from "@/lib/types";
import { MapPin, MessageCircle, Shield, ChevronLeft, ChevronRight, Star, CheckCircle2, Sparkles } from "lucide-react";
import { ChatDialog } from "@/components/ChatDialog";
import { OfferDialog } from "@/components/OfferDialog";
import { EscrowButton } from "@/components/EscrowButton";
import { ReviewSection } from "@/components/ReviewSection";
import { toast } from "sonner";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";

const AdDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [ad, setAd] = useState<DbAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  const markSold = async () => {
    if (!ad) return;
    setMarking(true);
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
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link to={`/browse?category=${encodeURIComponent(ad.category)}`} className="hover:text-foreground">
            {ad.category}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{ad.title}</span>
          <Link to="/agents" className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20" title="Agents can buy this via the API">
            Agent-friendly
          </Link>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-secondary mb-3">
              <img src={images[currentImage]} alt={ad.title} className="w-full h-full object-cover" />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImage((currentImage - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-card/80 backdrop-blur rounded-full flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentImage((currentImage + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-card/80 backdrop-blur rounded-full flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              <div className="absolute bottom-2 right-2 bg-card/80 backdrop-blur text-xs px-2 py-1 rounded">
                {currentImage + 1}/{images.length}
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 ${
                      i === currentImage ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">Description</h2>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{ad.description}</p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="text-2xl font-bold text-primary">
                  {Number(ad.price_usdc).toLocaleString()} USDC
                </div>
                <FavoriteButton adId={ad.id} size="lg" />
              </div>
              <h1 className="text-lg font-semibold text-foreground mb-3">{ad.title}</h1>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 bg-secondary px-2 py-1 rounded">
                  <MapPin className="w-3 h-3" />
                  {ad.location}
                </span>
                <span className="bg-secondary px-2 py-1 rounded">{ad.condition}</span>
                <span className="bg-secondary px-2 py-1 rounded">{ad.category}</span>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              {ad.status === "sold" ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-secondary rounded-lg text-sm font-semibold text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  This item has been sold
                </div>
              ) : user && user.id === ad.seller_id ? (
                <>
                  <Button onClick={markSold} disabled={marking} className="w-full gap-2 font-semibold py-5">
                    <CheckCircle2 className="w-4 h-4" />
                    {marking ? "Marking..." : "Mark as Sold"}
                  </Button>
                  <Link to={`/promote/${ad.id}`} className="block">
                    <Button variant="outline" className="w-full gap-2 py-5 border-primary/40 text-primary hover:bg-primary/5">
                      <Sparkles className="w-4 h-4" />
                      {ad.featured ? "Extend Featured Boost" : "Promote to Spotlight"}
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <EscrowButton adId={ad.id} sellerId={ad.seller_id} amount={Number(ad.price_usdc)} />
                  <Button variant="outline" className="w-full gap-2 py-5" onClick={() => setChatOpen(true)}>
                    <MessageCircle className="w-4 h-4" />
                    Chat with Seller
                  </Button>
                  <Button variant="secondary" className="w-full gap-2 py-5" onClick={() => setOfferOpen(true)}>
                    <Shield className="w-4 h-4" />
                    Make Offer with Escrow
                  </Button>
                </>
              )}
            </div>

            {ad.seller && (
              <Link
                to={`/seller/${ad.seller_id}`}
                className="block bg-card rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">Seller</h3>
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
                      {ad.seller.rating ?? "—"} · {ad.seller.total_ads ?? 0} ads
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Member since{" "}
                  {new Date(ad.seller.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>
              </Link>
            )}

            <ReviewSection adId={ad.id} sellerId={ad.seller_id} adSold={ad.status === "sold"} />
          </div>
        </div>
      </div>
      <ChatDialog open={chatOpen} onOpenChange={setChatOpen} adId={ad.id} sellerId={ad.seller_id} adTitle={ad.title} />
      <OfferDialog open={offerOpen} onOpenChange={setOfferOpen} adId={ad.id} listPrice={Number(ad.price_usdc)} />
    </Layout>
  );
};

export default AdDetail;
