import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { MessageCircle } from "lucide-react";

interface Conv {
  ad_id: string;
  other_id: string;
  last: string;
  created_at: string;
  ad_title?: string;
  ad_image?: string;
  other_name?: string;
}

const Messages = () => {
  const { user, resolving } = useRequireAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conv[]>([]);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (!msgs) return;
      const map = new Map<string, Conv>();
      for (const m of msgs as any[]) {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        const key = `${m.ad_id}::${other}`;
        if (!map.has(key)) map.set(key, { ad_id: m.ad_id, other_id: other, last: m.content, created_at: m.created_at });
      }
      const arr = [...map.values()];
      const adIds = [...new Set(arr.map((c) => c.ad_id))].filter(Boolean);
      const otherIds = [...new Set(arr.map((c) => c.other_id))];
      const [{ data: ads }, { data: profs }] = await Promise.all([
        supabase.from("ads").select("id,title,images").in("id", adIds),
        supabase.from("profiles").select("id,display_name").in("id", otherIds),
      ]);
      const adMap = new Map((ads || []).map((a: any) => [a.id, a]));
      const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
      setConvs(arr.map((c) => ({
        ...c,
        ad_title: adMap.get(c.ad_id)?.title,
        ad_image: adMap.get(c.ad_id)?.images?.[0],
        other_name: pMap.get(c.other_id)?.display_name || "User",
      })));
    })();
  }, [user]);

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" /> Messages
        </h1>
        {convs.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl text-muted-foreground text-sm">
            No conversations yet
          </div>
        ) : (
          <div className="space-y-2">
            {convs.map((c) => (
              <Link
                key={`${c.ad_id}-${c.other_id}`}
                to={`/ad/${c.ad_id}`}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition"
              >
                <img src={c.ad_image || "/placeholder.svg"} alt="" className="w-12 h-12 rounded-lg object-cover bg-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{c.other_name} · {c.ad_title}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.last}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Messages;
