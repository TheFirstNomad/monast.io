import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { ESCROW_STATUS_LABEL, EscrowStatus } from "@/lib/escrow";
import { getExplorerUrl, getExplorerName, PaymentChainId } from "@/lib/arcAppKit";
import { useSeo } from "@/hooks/useSeo";
import {
  ShoppingBag,
  Receipt,
  Store,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Package,
  Wallet,
  TrendingUp,
} from "lucide-react";

interface EscrowRow {
  id: string;
  ad_id: string;
  amount_usdc: number;
  status: EscrowStatus;
  created_at: string;
  ad_title?: string;
}

interface PaymentRow {
  id: string;
  ad_id: string;
  amount_usdc: number;
  tx_hash: string;
  chain_id: number;
  created_at: string;
  ad_title?: string;
}

interface SoldAdRow {
  id: string;
  title: string;
  price_usdc: number;
  sold_at: string | null;
  created_at: string;
  images: string[];
}

const STATUS_COLOR: Record<EscrowStatus, string> = {
  created: "bg-yellow-500/10 text-yellow-500",
  funded: "bg-blue-500/10 text-blue-500",
  released: "bg-green-500/10 text-green-500",
  refunded: "bg-muted text-muted-foreground",
  disputed: "bg-red-500/10 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

const Account = () => {
  const { user, resolving } = useRequireAuth();
  const [escrows, setEscrows] = useState<EscrowRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [soldAds, setSoldAds] = useState<SoldAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useSeo({
    title: "My account | monast.io escrow",
    description:
      "Your escrow orders, USDC payment history, and sold listings in one place on monast.io.",
  });

  const load = useCallback(async () => {
    if (!user) return;
    const [escrowRes, paymentRes, soldRes] = await Promise.all([
      supabase
        .from("escrows")
        .select("id, ad_id, amount_usdc, status, created_at")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, ad_id, amount_usdc, tx_hash, chain_id, created_at")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("ads")
        .select("id, title, price_usdc, sold_at, created_at, images")
        .eq("seller_id", user.id)
        .eq("status", "sold")
        .order("sold_at", { ascending: false, nullsFirst: false }),
    ]);

    const escrowRows = (escrowRes.data as EscrowRow[]) || [];
    const paymentRows = (paymentRes.data as PaymentRow[]) || [];
    const adIds = [
      ...new Set([...escrowRows.map((e) => e.ad_id), ...paymentRows.map((p) => p.ad_id)]),
    ];
    if (adIds.length) {
      const { data: ads } = await supabase.from("ads").select("id,title").in("id", adIds);
      const map = new Map((ads || []).map((a) => [a.id as string, a.title as string]));
      setEscrows(escrowRows.map((e) => ({ ...e, ad_title: map.get(e.ad_id) })));
      setPayments(paymentRows.map((p) => ({ ...p, ad_title: map.get(p.ad_id) })));
    } else {
      setEscrows(escrowRows);
      setPayments(paymentRows);
    }
    setSoldAds((soldRes.data as SoldAdRow[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the account view current while the tab is open.
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(tick, 20000);
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
  if (!user) return null;

  const totalSpent = payments.reduce((sum, p) => sum + Number(p.amount_usdc), 0);
  const totalEarned = soldAds.reduce((sum, a) => sum + Number(a.price_usdc), 0);
  const inEscrow = escrows.filter(
    (e) => e.status === "created" || e.status === "funded" || e.status === "disputed",
  ).length;

  const EscrowList = () =>
    escrows.length === 0 ? (
      <Empty text="No escrow orders yet." cta="Browse listings" to="/browse" />
    ) : (
      <div className="space-y-3">
        {escrows.map((e) => (
          <Link
            key={e.id}
            to={`/escrow/${e.id}`}
            className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {e.ad_title || "Listing"}
              </div>
              <div className="text-xs text-muted-foreground">
                Ordered {new Date(e.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="text-primary font-bold text-sm shrink-0">
              {Number(e.amount_usdc).toLocaleString()} USDC
            </div>
            <span className={`shrink-0 text-xs px-2 py-1 rounded ${STATUS_COLOR[e.status]}`}>
              {ESCROW_STATUS_LABEL[e.status]}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    );

  const PaymentList = () =>
    payments.length === 0 ? (
      <Empty text="No payments yet." cta="Browse listings" to="/browse" />
    ) : (
      <div className="space-y-3">
        {payments.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 bg-card border border-border rounded-xl p-4"
          >
            <div className="flex-1 min-w-0">
              <Link
                to={`/ad/${p.ad_id}`}
                className="text-sm font-medium text-foreground truncate hover:text-primary block"
              >
                {p.ad_title || "Listing"}
              </Link>
              <div className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleString()}
              </div>
            </div>
            <div className="text-primary font-bold text-sm shrink-0">
              {Number(p.amount_usdc).toLocaleString()} USDC
            </div>
            <a
              href={getExplorerUrl((p.chain_id as PaymentChainId) ?? 5042002, p.tx_hash)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
            >
              {getExplorerName((p.chain_id as PaymentChainId) ?? 5042002)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
      </div>
    );

  const SoldList = () =>
    soldAds.length === 0 ? (
      <Empty text="Nothing sold yet." cta="Post an ad" to="/post-ad" />
    ) : (
      <div className="space-y-3">
        {soldAds.map((a) => (
          <Link
            key={a.id}
            to={`/ad/${a.id}`}
            className="flex items-center gap-4 bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition-colors"
          >
            <img
              src={a.images?.[0] || "/placeholder.svg"}
              alt={a.title}
              className="w-16 h-16 rounded-lg object-cover bg-secondary shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{a.title}</div>
              <div className="text-primary font-bold text-sm">
                {Number(a.price_usdc).toLocaleString()} USDC
              </div>
              <div className="text-xs text-muted-foreground">
                Sold {new Date(a.sold_at || a.created_at).toLocaleDateString()}
              </div>
            </div>
            <span className="shrink-0 text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">
              Sold
            </span>
          </Link>
        ))}
      </div>
    );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">My account</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={manualRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Your orders, payments, and sales - buyer and seller activity in one place.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat icon={Package} label="In escrow" value={String(inEscrow)} />
          <Stat
            icon={Wallet}
            label="Total paid"
            value={`${totalSpent.toLocaleString()} USDC`}
          />
          <Stat
            icon={TrendingUp}
            label="Total sold"
            value={`${totalEarned.toLocaleString()} USDC`}
          />
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="mb-4">
            <TabsTrigger value="orders">Orders ({escrows.length})</TabsTrigger>
            <TabsTrigger value="payments">
              <Receipt className="w-3.5 h-3.5 mr-1.5" />
              Payments ({payments.length})
            </TabsTrigger>
            <TabsTrigger value="sold">
              <Store className="w-3.5 h-3.5 mr-1.5" />
              Sold ({soldAds.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="orders">{loading ? <Loading /> : <EscrowList />}</TabsContent>
          <TabsContent value="payments">{loading ? <Loading /> : <PaymentList />}</TabsContent>
          <TabsContent value="sold">{loading ? <Loading /> : <SoldList />}</TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
    <Icon className="w-5 h-5 text-primary shrink-0" />
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground truncate">{value}</div>
    </div>
  </div>
);

const Empty = ({ text, cta, to }: { text: string; cta: string; to: string }) => (
  <div className="text-center py-12 bg-card border border-border rounded-xl">
    <p className="text-muted-foreground mb-4">{text}</p>
    <Button asChild>
      <Link to={to}>{cta}</Link>
    </Button>
  </div>
);

const Loading = () => <p className="text-sm text-muted-foreground py-8">Loading…</p>;

export default Account;
