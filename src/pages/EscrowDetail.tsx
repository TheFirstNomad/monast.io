import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ESCROW_STATUS_LABEL, EscrowStatus } from "@/lib/escrow";
import { splitSale, SALE_FEE_LABEL } from "@/lib/fees";
import { toast } from "sonner";
import {
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Truck,
  Clock,
} from "lucide-react";
import { CircleFundButton } from "@/components/CircleFundButton";

interface EscrowRow {
  id: string;
  ad_id: string;
  buyer_id: string;
  seller_id: string;
  amount_usdc: number;
  status: EscrowStatus;
  chain_id: number;
  deposit_tx_hash: string | null;
  release_tx_hash: string | null;
  refund_tx_hash: string | null;
  platform_fee_usdc: number | null;
  seller_net_usdc: number | null;
  payout_status: string | null;
  cancel_requested_by: string | null;
  cancel_requested_at: string | null;
  cancel_reason: string | null;
  delivery_marked_at: string | null;
  auto_release_at: string | null;
  funded_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

const EscrowDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [escrow, setEscrow] = useState<EscrowRow | null>(null);
  const [adTitle, setAdTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("escrows").select("*").eq("id", id).maybeSingle();
    setEscrow((data as EscrowRow) ?? null);
    if (data?.ad_id) {
      const { data: ad } = await supabase.from("ads").select("title").eq("id", data.ad_id).maybeSingle();
      setAdTitle(ad?.title ?? "");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const call = async (fn: string, label: string, body: Record<string, unknown> = {}) => {
    if (!escrow) return;
    setAction(label);
    const { data, error } = await supabase.functions.invoke(fn, {
      body: { escrow_id: escrow.id, ...body },
    });
    setAction(null);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    toast.success(`${label} successful`);
    setShowCancelForm(false);
    setReason("");
    await load();
  };

  if (loading) return <Layout><div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div></Layout>;
  if (!escrow) return <Layout><div className="max-w-3xl mx-auto px-4 py-20 text-center">
    <h1 className="text-2xl font-bold mb-3">Escrow not found</h1>
    <Link to="/dashboard" className="text-primary hover:underline">Back to dashboard</Link>
  </div></Layout>;

  const isBuyer = user?.id === escrow.buyer_id;
  const isSeller = user?.id === escrow.seller_id;
  const amount = Number(escrow.amount_usdc);
  const split = splitSale(amount);
  const fee = escrow.platform_fee_usdc != null ? Number(escrow.platform_fee_usdc) : split.fee;
  const net = escrow.seller_net_usdc != null ? Number(escrow.seller_net_usdc) : split.sellerNet;

  const openCancelRequest = !!escrow.cancel_requested_at && escrow.status === "funded";
  const canRelease = isBuyer && (escrow.status === "funded" || escrow.status === "disputed");
  const canRefund = isSeller && (escrow.status === "funded" || escrow.status === "disputed");
  const canDispute = (isBuyer || isSeller) && escrow.status === "funded";
  const canRequestCancel =
    isBuyer && (escrow.status === "created" || escrow.status === "funded") && !escrow.cancel_requested_at;
  const canMarkDelivered = isSeller && escrow.status === "funded" && !escrow.delivery_marked_at;
  const payoutPending = escrow.payout_status === "pending" || escrow.payout_status === "processing";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Escrow</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          For <Link to={`/ad/${escrow.ad_id}`} className="text-foreground font-medium hover:underline">{adTitle || "ad"}</Link>
        </p>

        <div className="bg-card border border-border rounded-2xl p-5 mb-4 space-y-3">
          <Row k="Status" v={<span className="font-medium text-foreground">{ESCROW_STATUS_LABEL[escrow.status]}</span>} />
          <Row k="Amount in escrow" v={<span className="font-mono">{amount.toLocaleString()} USDC</span>} />
          <Row
            k={`Platform fee (${SALE_FEE_LABEL})`}
            v={<span className="font-mono">{fee.toLocaleString()} USDC</span>}
          />
          <Row
            k="Seller receives on release"
            v={<span className="font-mono font-medium text-foreground">{net.toLocaleString()} USDC</span>}
          />
          <Row k="Role" v={isBuyer ? "You are the buyer" : isSeller ? "You are the seller" : "Observer"} />
          <Row k="Created" v={new Date(escrow.created_at).toLocaleString()} />
          {escrow.funded_at && <Row k="Funded" v={new Date(escrow.funded_at).toLocaleString()} />}
          {escrow.delivery_marked_at && (
            <Row k="Marked delivered" v={new Date(escrow.delivery_marked_at).toLocaleString()} />
          )}
          {escrow.released_at && <Row k="Released" v={new Date(escrow.released_at).toLocaleString()} />}
          {escrow.refunded_at && <Row k="Refunded" v={new Date(escrow.refunded_at).toLocaleString()} />}
          {escrow.deposit_tx_hash && (
            <Row k="Deposit tx" v={<Hash value={escrow.deposit_tx_hash} />} />
          )}
          {escrow.release_tx_hash && <Row k="Payout tx" v={<Hash value={escrow.release_tx_hash} />} />}
          {escrow.refund_tx_hash && <Row k="Refund tx" v={<Hash value={escrow.refund_tx_hash} />} />}
        </div>

        {payoutPending && (
          <Note icon={<Loader2 className="w-4 h-4 animate-spin" />}>
            The on-chain transfer is in progress. This page updates once it confirms.
          </Note>
        )}

        {escrow.auto_release_at && escrow.status === "funded" && (
          <Note icon={<Clock className="w-4 h-4" />}>
            Funds release to the seller automatically on{" "}
            {new Date(escrow.auto_release_at).toLocaleString()} unless you confirm or dispute first.
          </Note>
        )}

        {openCancelRequest && (
          <Note icon={<XCircle className="w-4 h-4" />}>
            {isSeller
              ? "The buyer asked to cancel. Approve for a full refund, decline, or mark the item delivered."
              : "Your cancellation request is with the seller."}
            {escrow.cancel_reason && (
              <span className="block mt-1 text-muted-foreground">Reason: {escrow.cancel_reason}</span>
            )}
          </Note>
        )}

        <div className="space-y-2">
          {isBuyer && escrow.status === "created" && (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                This escrow is waiting for your payment.
              </p>
              <CircleFundButton
                escrowId={escrow.id}
                amount={amount}
                onFunded={load}
              />
            </>
          )}

          {canRelease && (
            <Button onClick={() => call("escrow-release", "Release")} disabled={!!action} className="w-full gap-2 py-5">
              {action === "Release" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm received & release to seller
            </Button>
          )}

          {canMarkDelivered && (
            <Button
              variant="outline"
              onClick={() => call("escrow-cancel", "Mark delivered", { action: "mark_delivered" })}
              disabled={!!action}
              className="w-full gap-2 py-5"
            >
              {action === "Mark delivered" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Mark as delivered
            </Button>
          )}

          {isSeller && openCancelRequest && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => call("escrow-cancel", "Approve cancellation", { action: "approve" })}
                disabled={!!action}
                className="gap-2 py-5"
              >
                {action === "Approve cancellation" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Approve & refund buyer
              </Button>
              <Button
                variant="secondary"
                onClick={() => call("escrow-cancel", "Decline cancellation", { action: "decline" })}
                disabled={!!action}
                className="gap-2 py-5"
              >
                {action === "Decline cancellation" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Decline
              </Button>
            </div>
          )}

          {canRefund && !openCancelRequest && (
            <Button variant="outline" onClick={() => call("escrow-refund", "Refund")} disabled={!!action} className="w-full gap-2 py-5">
              {action === "Refund" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Refund the buyer
            </Button>
          )}

          {canRequestCancel && !showCancelForm && (
            <Button variant="ghost" onClick={() => setShowCancelForm(true)} className="w-full gap-2 py-5">
              <XCircle className="w-4 h-4" />
              {escrow.status === "created" ? "Cancel this order" : "Request a cancellation"}
            </Button>
          )}

          {canRequestCancel && showCancelForm && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {escrow.status === "created"
                  ? "Nothing has been paid yet, so this cancels straight away at no cost."
                  : "You get 100% of your escrowed USDC back if the seller approves, or if they do not respond in time. No platform fee is charged on refunds."}
              </p>
              <Textarea
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => call("escrow-cancel", "Cancellation request", { action: "request", reason: reason || undefined })}
                  disabled={!!action}
                  className="gap-2"
                >
                  {action === "Cancellation request" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit
                </Button>
                <Button variant="ghost" onClick={() => setShowCancelForm(false)}>Never mind</Button>
              </div>
            </div>
          )}

          {canDispute && (
            <Button variant="secondary" onClick={() => call("escrow-dispute", "Dispute")} disabled={!!action} className="w-full gap-2 py-5">
              {action === "Dispute" ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              Open dispute
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{k}</span>
    <span className="text-right">{v}</span>
  </div>
);

const Hash = ({ value }: { value: string }) => (
  <span className="font-mono text-xs break-all">{value}</span>
);

const Note = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm mb-4">
    <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
    <span>{children}</span>
  </div>
);

export default EscrowDetail;
