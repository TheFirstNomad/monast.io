import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ESCROW_STATUS_LABEL, EscrowStatus } from "@/lib/escrow";
import { toast } from "sonner";
import { Shield, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";

interface EscrowRow {
  id: string;
  ad_id: string;
  buyer_id: string;
  seller_id: string;
  amount_usdc: number;
  status: EscrowStatus;
  chain_id: number;
  deposit_tx_hash: string | null;
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

  const call = async (fn: string, label: string) => {
    if (!escrow) return;
    setAction(label);
    const { data, error } = await supabase.functions.invoke(fn, { body: { escrow_id: escrow.id } });
    setAction(null);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    toast.success(label + " successful");
    await load();
  };

  if (loading) return <Layout><div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div></Layout>;
  if (!escrow) return <Layout><div className="max-w-3xl mx-auto px-4 py-20 text-center">
    <h1 className="text-2xl font-bold mb-3">Escrow not found</h1>
    <Link to="/dashboard" className="text-primary hover:underline">Back to dashboard</Link>
  </div></Layout>;

  const isBuyer = user?.id === escrow.buyer_id;
  const isSeller = user?.id === escrow.seller_id;
  const canRelease = isBuyer && (escrow.status === "funded" || escrow.status === "disputed");
  const canRefund = isSeller && (escrow.status === "funded" || escrow.status === "disputed");
  const canDispute = (isBuyer || isSeller) && escrow.status === "funded";

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

        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-3">
          <Row k="Status" v={<span className="font-medium text-foreground">{ESCROW_STATUS_LABEL[escrow.status]}</span>} />
          <Row k="Amount" v={<span className="font-mono">{Number(escrow.amount_usdc).toLocaleString()} USDC</span>} />
          <Row k="Role" v={isBuyer ? "You are the buyer" : isSeller ? "You are the seller" : "Observer"} />
          <Row k="Created" v={new Date(escrow.created_at).toLocaleString()} />
          {escrow.funded_at && <Row k="Funded" v={new Date(escrow.funded_at).toLocaleString()} />}
          {escrow.released_at && <Row k="Released" v={new Date(escrow.released_at).toLocaleString()} />}
          {escrow.refunded_at && <Row k="Refunded" v={new Date(escrow.refunded_at).toLocaleString()} />}
          {escrow.deposit_tx_hash && (
            <Row k="Deposit tx" v={<span className="font-mono text-xs break-all">{escrow.deposit_tx_hash}</span>} />
          )}
        </div>

        <div className="space-y-2">
          {canRelease && (
            <Button onClick={() => call("escrow-release", "Release")} disabled={!!action} className="w-full gap-2 py-5">
              {action === "Release" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm received & release to seller
            </Button>
          )}
          {canRefund && (
            <Button variant="outline" onClick={() => call("escrow-refund", "Refund")} disabled={!!action} className="w-full gap-2 py-5">
              {action === "Refund" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Refund the buyer
            </Button>
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

export default EscrowDetail;
