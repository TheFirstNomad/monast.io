import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ESCROW_STATUS_LABEL, EscrowStatus } from "@/lib/escrow";
import { Shield } from "lucide-react";

interface EscrowRow {
  id: string;
  ad_id: string;
  buyer_id: string;
  seller_id: string;
  amount_usdc: number;
  status: EscrowStatus;
  created_at: string;
}

const STATUS_COLOR: Record<EscrowStatus, string> = {
  created: "bg-muted text-muted-foreground",
  funded: "bg-success/10 text-success",
  released: "bg-success/10 text-success",
  refunded: "bg-muted text-muted-foreground",
  disputed: "bg-red-500/10 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

export const EscrowsList = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<(EscrowRow & { ad_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("escrows")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      const escrows = (data as EscrowRow[]) || [];
      if (escrows.length) {
        const adIds = [...new Set(escrows.map((e) => e.ad_id))];
        const { data: ads } = await supabase.from("ads").select("id,title").in("id", adIds);
        const map = new Map((ads || []).map((a: any) => [a.id, a.title]));
        setRows(escrows.map((e) => ({ ...e, ad_title: map.get(e.ad_id) })));
      } else {
        setRows([]);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" /> Escrow activity
      </h2>
      <div className="space-y-2">
        {rows.map((e) => {
          const role = e.buyer_id === user?.id ? "Buying" : "Selling";
          return (
            <Link
              key={e.id}
              to={`/escrow/${e.id}`}
              className="flex items-center justify-between bg-card border border-border rounded-xl p-4 min-h-20 hover:border-foreground/20 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">
                  {e.ad_title || "Ad"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {role} · <span className="price-nums">{Number(e.amount_usdc).toLocaleString()} USDC</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[e.status]}`}>
                {ESCROW_STATUS_LABEL[e.status]}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
