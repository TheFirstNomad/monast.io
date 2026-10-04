import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { useSeo } from "@/hooks/useSeo";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Package, DollarSign, Star, Eye, ShoppingBag } from "lucide-react";

interface AdStats {
  id: string;
  title: string;
  price_usdc: number;
  status: string;
  views: number;
  saves: number;
  escrows_count: number;
  completed_count: number;
  revenue_usdc: number;
}

interface Summary {
  total_revenue: number;
  total_listings: number;
  total_completed: number;
  avg_price: number;
  completion_rate: number;
}

const StatCard = ({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) => (
  <div className="bg-card border border-border rounded-xl p-5 flex gap-4 items-start">
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold price-nums text-foreground mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Analytics = () => {
  useSeo({
    title: "monast.io | Seller Analytics",
    description: "Track your listing performance, revenue, and buyer activity on monast.io.",
    canonicalPath: "/analytics",
  });

  const { user, resolving } = useRequireAuth();
  const [stats, setStats] = useState<AdStats[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_revenue: 0, total_listings: 0, total_completed: 0, avg_price: 0, completion_rate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Fetch all seller's ads
      const { data: ads } = await supabase
        .from("ads")
        .select("id, title, price_usdc, status")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (!ads?.length) { setLoading(false); return; }

      // Fetch escrow stats per ad
      const { data: escrows } = await supabase
        .from("escrows")
        .select("ad_id, status, amount_usdc")
        .eq("seller_id", user.id);

      const escrowMap: Record<string, { total: number; completed: number; revenue: number }> = {};
      for (const e of escrows ?? []) {
        if (!escrowMap[e.ad_id]) escrowMap[e.ad_id] = { total: 0, completed: 0, revenue: 0 };
        escrowMap[e.ad_id].total++;
        if (e.status === "released") {
          escrowMap[e.ad_id].completed++;
          escrowMap[e.ad_id].revenue += Number(e.amount_usdc) * 0.975; // after 2.5% fee
        }
      }

      // Fetch saves (favorites) per ad
      const adIds = ads.map((a) => a.id);
      const { data: favs } = await supabase
        .from("favorites")
        .select("ad_id")
        .in("ad_id", adIds);

      const savesMap: Record<string, number> = {};
      for (const f of favs ?? []) {
        savesMap[f.ad_id] = (savesMap[f.ad_id] ?? 0) + 1;
      }

      const adStats: AdStats[] = ads.map((a) => ({
        id: a.id,
        title: a.title,
        price_usdc: Number(a.price_usdc),
        status: a.status,
        views: 0, // view tracking not yet in DB — placeholder
        saves: savesMap[a.id] ?? 0,
        escrows_count: escrowMap[a.id]?.total ?? 0,
        completed_count: escrowMap[a.id]?.completed ?? 0,
        revenue_usdc: escrowMap[a.id]?.revenue ?? 0,
      }));

      const totalRevenue = adStats.reduce((s, a) => s + a.revenue_usdc, 0);
      const totalCompleted = adStats.reduce((s, a) => s + a.completed_count, 0);
      const totalEscrows = adStats.reduce((s, a) => s + a.escrows_count, 0);

      setSummary({
        total_revenue: totalRevenue,
        total_listings: ads.length,
        total_completed: totalCompleted,
        avg_price: ads.reduce((s, a) => s + Number(a.price_usdc), 0) / ads.length,
        completion_rate: totalEscrows > 0 ? (totalCompleted / totalEscrows) * 100 : 0,
      });

      setStats(adStats);
      setLoading(false);
    };

    load();
  }, [user]);

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  const chartData = stats
    .filter((s) => s.revenue_usdc > 0 || s.escrows_count > 0)
    .slice(0, 10)
    .map((s) => ({
      name: s.title.length > 22 ? s.title.slice(0, 22) + "…" : s.title,
      revenue: Number(s.revenue_usdc.toFixed(2)),
      escrows: s.escrows_count,
    }));

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <div>
          <h1 className="font-display text-4xl text-foreground">Seller Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Your listing performance at a glance.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Total revenue" value={`${summary.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`} sub="after 2.5% fee" />
          <StatCard icon={Package} label="Active listings" value={String(summary.total_listings)} />
          <StatCard icon={ShoppingBag} label="Completed sales" value={String(summary.total_completed)} />
          <StatCard icon={TrendingUp} label="Completion rate" value={`${summary.completion_rate.toFixed(0)}%`} sub={`avg price ${summary.avg_price.toFixed(0)} USDC`} />
        </div>

        {/* Revenue by listing chart */}
        {chartData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Revenue by listing</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(val: number) => [`${val} USDC`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-listing table */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Loading your stats…</div>
        ) : stats.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Eye className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">No listings yet. <Link to="/post-ad" className="text-primary hover:underline">Post your first listing.</Link></p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Listing</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Price</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Saves</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Escrows</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Completed</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.id} className={i < stats.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-4 py-3">
                      <Link to={`/ad/${s.id}`} className="text-foreground hover:text-primary truncate block max-w-[180px]">{s.title}</Link>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                        s.status === "active" ? "bg-green-500/10 text-green-500" :
                        s.status === "sold" ? "bg-primary/10 text-primary" :
                        "bg-muted text-muted-foreground"
                      }`}>{s.status}</span>
                    </td>
                    <td className="text-right px-4 py-3 price-nums text-foreground hidden md:table-cell">{s.price_usdc.toLocaleString()} USDC</td>
                    <td className="text-right px-4 py-3 text-foreground">{s.saves}</td>
                    <td className="text-right px-4 py-3 text-foreground">{s.escrows_count}</td>
                    <td className="text-right px-4 py-3 text-foreground hidden sm:table-cell">{s.completed_count}</td>
                    <td className="text-right px-4 py-3 price-nums font-medium text-primary">{s.revenue_usdc > 0 ? `${s.revenue_usdc.toFixed(2)} USDC` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Analytics;
