import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink } from "lucide-react";

interface Payment {
  id: string;
  ad_id: string;
  buyer_id: string;
  seller_id: string;
  amount_usdc: number;
  tx_hash: string;
  chain_id: number;
  created_at: string;
  ad?: { title: string; images: string[] } | null;
}

const Transactions = () => {
  const { user, resolving } = useRequireAuth();
  const [purchases, setPurchases] = useState<Payment[]>([]);
  const [sales, setSales] = useState<Payment[]>([]);


  useEffect(() => {
    if (!user) return;
    const sel = "*, ad:ads!payments_ad_id_fkey(title, images)";
    supabase
      .from("payments")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        setPurchases(await hydrate(data || []));
      });
    supabase
      .from("payments")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        setSales(await hydrate(data || []));
      });
  }, [user]);

  const hydrate = async (rows: any[]): Promise<Payment[]> => {
    if (!rows.length) return [];
    const ids = [...new Set(rows.map((r) => r.ad_id))];
    const { data: ads } = await supabase.from("ads").select("id, title, images").in("id", ids);
    const map = new Map((ads || []).map((a: any) => [a.id, a]));
    return rows.map((r) => ({ ...r, ad: map.get(r.ad_id) || null }));
  };

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  const renderList = (rows: Payment[], emptyText: string) =>
    rows.length === 0 ? (
      <div className="text-center py-12 bg-card border border-border rounded-xl text-muted-foreground text-sm">
        {emptyText}
      </div>
    ) : (
      <div className="space-y-3">
        {rows.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 bg-card border border-border rounded-xl p-3"
          >
            <Link to={`/ad/${p.ad_id}`} className="shrink-0">
              <img
                src={p.ad?.images?.[0] || "/placeholder.svg"}
                alt=""
                className="w-16 h-16 rounded-lg object-cover bg-secondary"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                to={`/ad/${p.ad_id}`}
                className="text-sm font-medium text-foreground truncate hover:text-primary block"
              >
                {p.ad?.title || "Ad"}
              </Link>
              <div className="text-primary font-bold text-sm">
                {Number(p.amount_usdc).toLocaleString()} USDC
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleString()}
              </div>
            </div>
            <a
              href={`https://arbiscan.io/tx/${p.tx_hash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Tx <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
      </div>
    );

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Transactions</h1>
        <Tabs defaultValue="purchases">
          <TabsList className="mb-4">
            <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
            <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="purchases">
            {renderList(purchases, "No purchases yet.")}
          </TabsContent>
          <TabsContent value="sales">{renderList(sales, "No sales yet.")}</TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Transactions;
