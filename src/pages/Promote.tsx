import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { DbAd } from "@/lib/types";
import { PROMOTION_TIERS, PromotionTier } from "@/lib/promotionTiers";
import { useTreasuryAddress } from "@/hooks/useTreasuryAddress";
import { USDC_ADDRESS, ERC20_TRANSFER_ABI, toUsdcUnits, ARC_CHAIN_ID } from "@/lib/usdc";
import { toast } from "sonner";
import { Sparkles, Check, Loader2, ArrowLeft, Wallet } from "lucide-react";
import { useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

const Promote = () => {
  const { adId } = useParams();
  const { user } = useAuth();
  const { address, connect } = useWallet();
  const navigate = useNavigate();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const { isSuccess, isLoading: confirming } = useWaitForTransactionReceipt({ hash: pendingHash });

  const [ad, setAd] = useState<DbAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<PromotionTier>("7d");
  const [activating, setActivating] = useState(false);
  const selected = PROMOTION_TIERS.find((t) => t.id === tier)!;
  const { treasury, error: treasuryError } = useTreasuryAddress("revenue", ARC_CHAIN_ID);
  const busy = isPending || confirming || activating;


  useEffect(() => {
    if (!adId) return;
    supabase.from("ads").select("*").eq("id", adId).maybeSingle()
      .then(({ data }) => { setAd(data as DbAd | null); setLoading(false); });
  }, [adId]);

  // After payment confirms, call the edge function to activate the promotion.
  useEffect(() => {
    if (!isSuccess || !pendingHash || !ad) return;
    (async () => {
      setActivating(true);
      const { data, error } = await supabase.functions.invoke("promote-checkout", {
        body: { ad_id: ad.id, tier, tx_hash: pendingHash, chain_id: ARC_CHAIN_ID },
      });
      setActivating(false);
      setPendingHash(undefined);
      if (error) return toast.error(error.message);
      if (data?.error) return toast.error(data.error);
      toast.success(`Ad featured until ${new Date(data.ends_at).toLocaleString()}`);
      navigate(`/ad/${ad.id}`);
    })();
  }, [isSuccess, pendingHash, ad, tier, navigate]);

  const promote = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!ad) return;
    if (!address) { await connect(); return; }
    if (!treasury) {
      toast.error(treasuryError ?? "Promotions are unavailable right now");
      return;
    }
    try {
      if (chainId !== ARC_CHAIN_ID) {
        await switchChainAsync({ chainId: ARC_CHAIN_ID });
      }
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [treasury.address, toUsdcUnits(selected.price)],
        chainId: ARC_CHAIN_ID,
      } as any);
      setPendingHash(hash);
      toast.success("Payment sent. Activating promotion...");
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Payment failed");
    }
  };

  if (loading) return <Layout><div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div></Layout>;
  if (!ad) return <Layout><div className="max-w-3xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold mb-3">Ad not found</h1><Link to="/dashboard" className="text-primary hover:underline">Back to dashboard</Link></div></Layout>;
  if (!user || user.id !== ad.seller_id) {
    return <Layout><div className="max-w-3xl mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold mb-3">You don't own this ad</h1><Link to="/dashboard"><Button>Back</Button></Link></div></Layout>;
  }

  const cover = ad.images?.[0] || "/placeholder.svg";
  const alreadyFeatured = ad.featured && (!ad.featured_until || new Date(ad.featured_until) > new Date());

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={`/ad/${ad.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to ad
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Promote this ad</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Pin <span className="text-foreground font-medium">{ad.title}</span> to the Spotlight and top of search.
        </p>

        <div className="grid md:grid-cols-3 gap-3 mb-8">
          {PROMOTION_TIERS.map((t) => {
            const active = t.id === tier;
            return (
              <button
                key={t.id}
                onClick={() => setTier(t.id)}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</span>
                  {t.highlight && <span className="text-[10px] font-bold text-primary uppercase">{t.highlight}</span>}
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums">{t.price} <span className="text-xs font-medium text-muted-foreground">USDC</span></div>
                <div className="text-xs text-muted-foreground mt-1">{t.duration}</div>
              </button>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-semibold mb-3">Preview</h2>
          <div className="flex gap-3 items-center bg-gradient-to-br from-card to-primary/5 border border-primary/30 rounded-xl p-3">
            <img src={cover} alt={ad.title} className="w-20 h-20 object-cover rounded-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase mb-1">
                <Sparkles className="w-3 h-3" /> Featured
              </div>
              <div className="text-sm font-semibold truncate">{ad.title}</div>
              <div className="text-sm text-primary font-bold">{Number(ad.price_usdc).toLocaleString()} USDC</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-2 text-sm">
          {[
            "Pinned to home Spotlight carousel",
            "Top placement in /browse and category pages",
            "Highlighted card with Featured badge",
            "Priority in Agent API responses",
          ].map((f) => (
            <div key={f} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" /> {f}
            </div>
          ))}
        </div>

        {alreadyFeatured && (
          <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary text-sm">
            Already featured until {new Date(ad.featured_until!).toLocaleString()}. Buying another tier extends the boost.
          </div>
        )}

        <Button onClick={promote} disabled={busy} className="w-full py-6 text-base font-semibold gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          {activating ? "Activating…" : confirming ? "Confirming payment…" : isPending ? "Awaiting wallet…" : `Pay ${selected.price} USDC to feature`}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Payment goes to the marketplace treasury. Boost activates the moment your transaction confirms.
        </p>
      </div>
    </Layout>
  );
};

export default Promote;
