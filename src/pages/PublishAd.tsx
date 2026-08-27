import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { DbAd } from "@/lib/types";
import { USDC_ADDRESS, ERC20_TRANSFER_ABI, toUsdcUnits, ARC_CHAIN_ID } from "@/lib/usdc";
import { useTreasuryAddress } from "@/hooks/useTreasuryAddress";
import { useSeo } from "@/hooks/useSeo";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";
import { useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { sendUsdcPayment, resolvePayingWallet } from "@/lib/payments/sendUsdc";
import { getFunctionErrorMessage } from "@/lib/functionErrors";

/**
 * Listing-fee checkout. An ad stays in `pending_fee` - invisible to buyers  - 
 * until this small USDC fee is confirmed on-chain, which is what keeps the
 * marketplace free of spam listings.
 */
const PublishAd = () => {
  const { adId } = useParams();
  const { user } = useAuth();
  const { address, connect } = useWallet();
  const navigate = useNavigate();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();
  const { isSuccess, isLoading: mining } = useWaitForTransactionReceipt({ hash: pendingHash });
  const { treasury, error: treasuryError, loading: treasuryLoading } = useTreasuryAddress(
    "revenue",
    ARC_CHAIN_ID,
  );

  const [ad, setAd] = useState<DbAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [circleWallet, setCircleWallet] = useState(false);
  const [circlePaying, setCirclePaying] = useState(false);
  const fee = treasury?.listingFeeUsdc ?? 0.15;
  const busy = isPending || mining || verifying || circlePaying;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    resolvePayingWallet(user.id).then((w) => { if (!cancelled) setCircleWallet(w.isCircleWallet); });
    return () => { cancelled = true; };
  }, [user]);

  useSeo({
    title: "Publish your listing | monast.io",
    description: "Pay the small USDC listing fee to publish your listing on monast.io.",
    noindex: true,
  });

  useEffect(() => {
    if (!adId) return;
    supabase
      .from("ads")
      .select("*")
      .eq("id", adId)
      .maybeSingle()
      .then(({ data }) => {
        setAd(data as DbAd | null);
        setLoading(false);
      });
  }, [adId]);

  // Once the fee transaction is mined, the backend verifies it on-chain and
  // flips the ad to active. The client never marks the fee as paid itself.
  const verifyFee = async (txHash: string) => {
    if (!ad) return;
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke("ad-listing-fee", {
      body: { ad_id: ad.id, tx_hash: txHash, chain_id: ARC_CHAIN_ID },
    });
    setVerifying(false);
    setPendingHash(undefined);
    if (error) return toast.error(await getFunctionErrorMessage(error, "Could not verify listing fee"));
    if (data?.error) return toast.error(data.error);
    toast.success("Listing published");
    navigate(`/ad/${ad.id}`);
  };

  useEffect(() => {
    if (!isSuccess || !pendingHash || !ad) return;
    void verifyFee(pendingHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, pendingHash, ad]);

  const pay = async () => {
    if (!user || !ad) return;
    // Circle wallets sign through Circle's SDK; the fee verifier is unchanged.
    if (circleWallet) {
      setCirclePaying(true);
      try {
        const { txHash } = await sendUsdcPayment({
          purpose: "listing_fee",
          referenceId: ad.id,
          isCircleWallet: true,
        });
        toast.success("Fee sent. Verifying on-chain…");
        await verifyFee(txHash);
      } catch (e: any) {
        toast.error(e?.message || "Payment failed");
      } finally {
        setCirclePaying(false);
      }
      return;
    }
    if (!address) { await connect(); return; }
    if (!treasury) {
      toast.error(treasuryError ?? "Publishing is unavailable right now");
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
        args: [treasury.address, toUsdcUnits(fee)],
        chainId: ARC_CHAIN_ID,
      } as any);
      setPendingHash(hash);
      toast.success("Fee sent. Verifying on-chain…");
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Payment failed");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>
      </Layout>
    );
  }

  if (!ad) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-3">Listing not found</h1>
          <Link to="/dashboard" className="text-primary hover:underline">Back to dashboard</Link>
        </div>
      </Layout>
    );
  }

  if (!user || user.id !== ad.seller_id) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-3">You don't own this listing</h1>
          <Link to="/dashboard"><Button>Back to dashboard</Button></Link>
        </div>
      </Layout>
    );
  }

  if (ad.status !== "pending_fee") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <Check className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">This listing is already published</h1>
          <Link to={`/ad/${ad.id}`}><Button>View listing</Button></Link>
        </div>
      </Layout>
    );
  }

  const cover = ad.images?.[0] || "/placeholder.svg";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <h1 className="text-2xl font-bold mb-1">Publish your listing</h1>
        <p className="text-muted-foreground mb-6">
          A one-time {fee} USDC fee keeps monast.io free of spam listings. It is charged once per
          listing and is not refundable.
        </p>

        <div className="flex gap-4 items-center rounded-xl border border-border bg-card p-4 mb-6">
          <img src={cover} alt={ad.title} className="w-20 h-20 rounded-lg object-cover" loading="lazy" />
          <div className="min-w-0">
            <p className="font-semibold truncate">{ad.title}</p>
            <p className="text-sm text-muted-foreground">
              {Number(ad.price_usdc).toLocaleString()} USDC · {ad.location}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Listing fee</span>
            <span className="text-xl font-bold">{fee} USDC</span>
          </div>

          {treasuryError ? (
            <div className="space-y-2">
              <Button disabled className="w-full py-5 font-semibold">Publishing unavailable</Button>
              <p className="text-xs text-muted-foreground text-center">{treasuryError}</p>
            </div>
          ) : (
            <Button
              onClick={pay}
              disabled={busy || treasuryLoading}
              className="w-full py-5 font-semibold gap-2"
            >
              {busy || treasuryLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ShieldCheck className="w-4 h-4" />}
              {verifying
                ? "Verifying payment…"
                : mining
                  ? "Confirming…"
                  : isPending
                    ? "Awaiting wallet…"
                    : `Pay ${fee} USDC and publish`}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Paid in USDC on Arc. Your listing goes live the moment the payment is confirmed
            on-chain.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default PublishAd;
