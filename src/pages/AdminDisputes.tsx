import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { useSeo } from "@/hooks/useSeo";
import { splitSale } from "@/lib/fees";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { AlertTriangle, Gavel, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

interface DisputedEscrow {
  id: string;
  ad_id: string;
  amount_usdc: number;
  chain_id: number;
  buyer_id: string;
  seller_id: string;
  cancel_reason: string | null;
  delivery_marked_at: string | null;
  funded_at: string | null;
  updated_at: string;
  metadata: any;
  ads?: { id: string; title: string; images: string[] } | null;
}

/** Arbitrator-only dispute queue. Resolving pays out through the same guarded path. */
const AdminDisputes = () => {
  const { user } = useAuth();
  const { isArbitrator, loading: rolesLoading } = useRoles();
  const [escrows, setEscrows] = useState<DisputedEscrow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useSeo({
    title: "Dispute queue | monast.io",
    description: "Arbitrator-only escrow dispute queue.",
    noindex: true,
  });

  const load = useCallback(async () => {
    if (!isArbitrator) return;
    setLoading(true);
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("admin-disputes", {
      body: { action: "list" },
    });
    if (fnErr || data?.error) setError(data?.error ?? fnErr?.message ?? "Could not load disputes");
    else setEscrows(data.escrows ?? []);
    setLoading(false);
  }, [isArbitrator]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string, outcome: "release" | "refund") => {
    setBusy(id + outcome);
    const { data, error: fnErr } = await supabase.functions.invoke("admin-disputes", {
      body: { action: "resolve", escrow_id: id, outcome, notes: notes[id] ?? null },
    });
    setBusy(null);
    if (fnErr || data?.error) {
      toast.error(data?.error ?? fnErr?.message ?? "Resolution failed");
      return;
    }
    toast.success(outcome === "release" ? "Released to the seller" : "Refunded to the buyer");
    load();
  };

  if (!rolesLoading && (!user || !isArbitrator)) {
    return (
      <Layout>
        <div className="container max-w-2xl py-20 text-center space-y-4">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Arbitrators only</h1>
          <p className="text-muted-foreground">
            This queue is limited to accounts holding the arbitrator role. Ask the platform owner to
            grant it from the roles console.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" />
              Dispute queue
            </h1>
            <p className="text-sm text-muted-foreground">
              Every resolution moves real USDC and cannot be undone.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
            {error}
          </div>
        )}

        {!loading && escrows.length === 0 && !error && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            No open disputes. 
          </div>
        )}

        {escrows.map((esc) => {
          const split = splitSale(Number(esc.amount_usdc));
          const dispute = esc.metadata?.dispute;
          return (
            <div key={esc.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to={`/ad/${esc.ad_id}`} className="font-semibold hover:text-primary">
                    {esc.ads?.title ?? "Listing"}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {Number(esc.amount_usdc).toLocaleString()} USDC in escrow · chain {esc.chain_id}
                  </p>
                </div>
                <Badge variant="destructive">disputed</Badge>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Delivery marked: </span>
                  {esc.delivery_marked_at ? new Date(esc.delivery_marked_at).toLocaleString() : "no"}
                </div>
                <div>
                  <span className="text-muted-foreground">Cancellation: </span>
                  {esc.cancel_reason ?? "none"}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Dispute reason: </span>
                  {dispute?.reason || "not provided"}
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                Release pays the seller {split.sellerNet} USDC and sweeps {split.fee} USDC as the
                platform fee. Refund returns the full {split.gross} USDC to the buyer with no fee.
              </div>

              <Textarea
                rows={2}
                placeholder="Resolution notes (stored on the escrow record)"
                value={notes[esc.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [esc.id]: e.target.value }))}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => resolve(esc.id, "release")}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  {busy === esc.id + "release" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Release to seller
                </Button>
                <Button
                  variant="outline"
                  onClick={() => resolve(esc.id, "refund")}
                  disabled={busy !== null}
                  className="gap-2"
                >
                  {busy === esc.id + "refund" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Refund buyer
                </Button>
                <Button variant="ghost" asChild>
                  <Link to={`/escrow/${esc.id}`}>Open escrow</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
};

export default AdminDisputes;
