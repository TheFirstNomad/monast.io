import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { EscrowFundButton } from "@/components/EscrowFundButton";
import { ESCROW_STATUS_LABEL, EscrowStatus } from "@/lib/escrow";
import { splitSale, SALE_FEE_LABEL } from "@/lib/fees";
import { useSeo } from "@/hooks/useSeo";
import {
  ShoppingBag,
  Shield,
  Clock,
  CheckCircle2,
  Truck,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface PurchaseRow {
  id: string;
  ad_id: string;
  seller_id: string;
  amount_usdc: number;
  status: EscrowStatus;
  payout_status: string | null;
  delivery_marked_at: string | null;
  auto_release_at: string | null;
  funded_at: string | null;
  released_at: string | null;
  created_at: string;
  ad_title?: string;
}

const STATUS_COLOR: Record<EscrowStatus, string> = {
  created: "bg-yellow-500/10 text-yellow-500",
  funded: "bg-blue-500/10 text-blue-500",
  released: "bg-green-500/10 text-green-500",
  refunded: "bg-muted text-muted-foreground",
  disputed: "bg-red-500/10 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

/** Where the buyer's money is right now, in plain language. */
const stage = (p: PurchaseRow) => {
  if (p.status === "created") return "Waiting for your payment";
  if (p.status === "funded")
    return p.delivery_marked_at
      ? "Seller marked it delivered - confirm to release"
      : "Held in escrow until the seller delivers";
  if (p.status === "disputed") return "Under dispute - an arbitrator will decide";
  if (p.status === "released") return "Released to the seller";
  if (p.status === "refunded") return "Refunded to your wallet";
  return "Cancelled - nothing was charged";
};

const Purchases = () => {
  const { user, resolving } = useRequireAuth();
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useSeo({
    title: "My purchases | monast.io escrow",
    description:
      "Pay for a purchase from your own wallet and follow the escrow from payment to release, all in USDC on Arc.",
  });

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("escrows")
      .select(
        "id, ad_id, seller_id, amount_usdc, status, payout_status, delivery_marked_at, auto_release_at, funded_at, released_at, created_at",
      )
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    const escrows = (data as PurchaseRow[]) || [];
    if (escrows.length) {
      const adIds = [...new Set(escrows.map((e) => e.ad_id))];
      const { data: ads } = await supabase.from("ads").select("id,title").in("id", adIds);
      const map = new Map((ads || []).map((a) => [a.id as string, a.title as string]));
      setRows(escrows.map((e) => ({ ...e, ad_title: map.get(e.ad_id) })));
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // An escrow moves on the server (seller marks delivery, auto-release, payout
  // confirms), so the buyer's view keeps itself current while the tab is open.
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [user, load]);

  const manualRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (resolving) return <AuthResolving />;

  const awaitingPayment = rows.filter((r) => r.status === "created");
  const active = rows.filter((r) => r.status === "funded" || r.status === "disputed");
  const done = rows.filter((r) =>
    ["released", "refunded", "cancelled"].includes(r.status),
  );

  const Card = ({ p }: { p: PurchaseRow }) => {
    const amount = Number(p.amount_usdc);
    const split = splitSale(amount);
    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/ad/${p.ad_id}`}
              className="font-semibold text-foreground hover:underline block truncate"
            >
              {p.ad_title || "Listing"}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ordered {new Date(p.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className={`shrink-0 text-xs px-2 py-1 rounded ${STATUS_COLOR[p.status]}`}>
            {ESCROW_STATUS_LABEL[p.status]}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-semibold text-foreground">
            {amount.toLocaleString()} USDC
          </span>
          <span className="text-xs text-muted-foreground">
            seller gets {split.sellerNet.toLocaleString()} after the {SALE_FEE_LABEL} fee
          </span>
        </div>

        <p className="text-sm text-muted-foreground flex items-start gap-2">
          <Shield className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          {stage(p)}
        </p>

        {p.delivery_marked_at && p.status === "funded" && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Truck className="w-3.5 h-3.5" />
            Delivered {new Date(p.delivery_marked_at).toLocaleString()}
          </p>
        )}
        {p.auto_release_at && p.status === "funded" && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Auto-releases {new Date(p.auto_release_at).toLocaleString()} unless you confirm or
            dispute
          </p>
        )}
        {(p.payout_status === "pending" || p.payout_status === "processing") && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Payout to the seller is in progress
          </p>
        )}
        {p.status === "released" && p.released_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Completed {new Date(p.released_at).toLocaleString()}
          </p>
        )}

        {p.status === "created" ? (
          <div className="space-y-2">
            <EscrowFundButton escrowId={p.id} amount={amount} onFunded={load} />
            <p className="text-xs text-muted-foreground">
              Paid from your own wallet. The USDC sits in escrow until you confirm the item.
            </p>
          </div>
        ) : null}

        <Link to={`/escrow/${p.id}`} className="block">
          <Button variant="outline" className="w-full">
            {p.status === "funded" ? "Track & release" : "View escrow"}
          </Button>
        </Link>
      </div>
    );
  };

  const List = ({ items, empty }: { items: PurchaseRow[]; empty: string }) => {
    if (loading) return <p className="text-sm text-muted-foreground py-8">Loading…</p>;
    if (items.length === 0)
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{empty}</p>
          <Link to="/browse">
            <Button>Browse listings</Button>
          </Link>
        </div>
      );
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((p) => (
          <Card key={p.id} p={p} />
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">My purchases</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={manualRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Pay from your own wallet and follow every order from payment to release.
        </p>

        <Tabs defaultValue={awaitingPayment.length ? "pay" : "active"}>
          <TabsList className="mb-4">
            <TabsTrigger value="pay">To pay ({awaitingPayment.length})</TabsTrigger>
            <TabsTrigger value="active">In escrow ({active.length})</TabsTrigger>
            <TabsTrigger value="done">Completed ({done.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pay">
            <List items={awaitingPayment} empty="Nothing waiting for payment." />
          </TabsContent>
          <TabsContent value="active">
            <List items={active} empty="No purchases are in escrow right now." />
          </TabsContent>
          <TabsContent value="done">
            <List items={done} empty="No completed purchases yet." />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Purchases;
