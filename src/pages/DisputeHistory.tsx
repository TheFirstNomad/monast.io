import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { useSeo } from "@/hooks/useSeo";
import { Shield, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface DisputeRow {
  id: string;
  ad_id: string;
  ad_title: string;
  buyer_id: string;
  seller_id: string;
  amount_usdc: number;
  status: string;
  created_at: string;
  funded_at: string | null;
  disputed_at: string | null;
  resolved_at: string | null;
  role: "buyer" | "seller";
}

const statusConfig: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  disputed: { label: "Under review", color: "text-yellow-500 bg-yellow-500/10", Icon: AlertTriangle },
  released: { label: "Resolved — seller paid", color: "text-green-500 bg-green-500/10", Icon: CheckCircle2 },
  refunded: { label: "Resolved — buyer refunded", color: "text-blue-400 bg-blue-400/10", Icon: XCircle },
};

const Timeline = ({ row }: { row: DisputeRow }) => {
  const steps = [
    { label: "Escrow funded", date: row.funded_at, done: !!row.funded_at },
    { label: "Dispute opened", date: row.disputed_at, done: !!row.disputed_at },
    { label: "Arbitration complete", date: row.resolved_at, done: !!row.resolved_at },
  ];
  return (
    <ol className="flex flex-col gap-1 mt-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2 text-xs">
          <span className={`mt-0.5 w-3 h-3 rounded-full border flex-shrink-0 ${s.done ? "bg-primary border-primary" : "border-border bg-muted"}`} />
          <span className={s.done ? "text-foreground" : "text-muted-foreground"}>
            {s.label}
            {s.date && <span className="text-muted-foreground ml-1.5">{new Date(s.date).toLocaleDateString()}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
};

const DisputeHistory = () => {
  useSeo({
    title: "monast.io | Dispute History",
    description: "Track all your dispute cases on monast.io — status, timeline, and arbitration outcomes.",
    canonicalPath: "/disputes",
  });

  const { user, resolving } = useRequireAuth();
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("escrows")
        .select("id, ad_id, buyer_id, seller_id, amount_usdc, status, created_at, funded_at, disputed_at, resolved_at, ad:ads(title)")
        .in("status", ["disputed", "released", "refunded"])
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      const rows: DisputeRow[] = (data ?? []).map((e: any) => ({
        id: e.id,
        ad_id: e.ad_id,
        ad_title: e.ad?.title ?? "Listing",
        buyer_id: e.buyer_id,
        seller_id: e.seller_id,
        amount_usdc: Number(e.amount_usdc),
        status: e.status,
        created_at: e.created_at,
        funded_at: e.funded_at,
        disputed_at: e.disputed_at,
        resolved_at: e.resolved_at,
        role: e.buyer_id === user.id ? "buyer" : "seller",
      }));
      setDisputes(rows);
      setLoading(false);
    };
    load();
  }, [user]);

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 space-y-6">
        <div>
          <h1 className="font-display text-4xl text-foreground">Dispute History</h1>
          <p className="text-sm text-muted-foreground mt-1">All your escrow dispute cases — open, resolved, and refunded.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Loading…</div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">No disputes on record. That is a good thing.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => {
              const cfg = statusConfig[d.status] ?? statusConfig.disputed;
              return (
                <div key={d.id} className="bg-card border border-border rounded-xl p-5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/ad/${d.ad_id}`} className="font-semibold text-foreground hover:text-primary truncate block">{d.ad_title}</Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You are the <span className="text-foreground font-medium">{d.role}</span>
                        <span className="mx-1.5">·</span>
                        <span className="price-nums">{d.amount_usdc.toLocaleString()} USDC</span>
                        <span className="mx-1.5">·</span>
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 flex items-center gap-1 ${cfg.color}`}>
                      <cfg.Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                  <Timeline row={d} />
                  <div className="pt-1">
                    <Link
                      to={`/escrow/${d.id}`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      View escrow detail <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DisputeHistory;
