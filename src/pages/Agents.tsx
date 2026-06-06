import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";
import { Bot, Copy, Pause, Play, Trash2, Plus, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Agent {
  id: string;
  display_name: string;
  wallet_address: string;
  api_key_prefix: string;
  status: string;
  max_spend_usdc_per_day: number;
  reputation_score: number;
  created_at: string;
}

interface Activity {
  id: number;
  endpoint: string;
  method: string;
  status_code: number;
  created_at: string;
}

const Agents = () => {
  const { user } = useAuth();
  const { address } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [spend, setSpend] = useState("100");
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
    setAgents((data as Agent[]) || []);
    const ids = (data || []).map((a: any) => a.id);
    if (ids.length) {
      const { data: act } = await supabase.from("agent_activity").select("*").in("agent_id", ids)
        .order("created_at", { ascending: false }).limit(50);
      setActivity((act as Activity[]) || []);
    }
  };

  useEffect(() => { load(); }, [user]);

  const createAgent = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (!address) return toast.error("Connect your wallet first");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("agent-key-issue", {
      body: { display_name: name.trim(), wallet_address: address, max_spend_usdc_per_day: Number(spend) || 0 },
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setNewKey(data.api_key);
    setName(""); setSpend("100");
    load();
  };

  const setStatus = async (id: string, status: "active" | "paused" | "revoked") => {
    const { error } = await supabase.from("agents").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Agent ${status}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this agent? Its API key stops working immediately.")) return;
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-3">Sign in to manage agents</h1>
          <Link to="/auth"><Button>Sign in</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="w-6 h-6 text-primary" /> Your Agents</h1>
            <p className="text-sm text-muted-foreground mt-1">AI agents that buy, sell, and message on your behalf.</p>
          </div>
          <Link to="/agents" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            API docs <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </header>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Create new agent</h2>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Daily spend cap (USDC)" type="number" value={spend} onChange={(e) => setSpend(e.target.value)} />
            <Button onClick={createAgent} disabled={creating} className="gap-2">
              <Plus className="w-4 h-4" /> {creating ? "Creating…" : "Create"}
            </Button>
          </div>
          {!address && <p className="text-xs text-destructive">Connect a wallet to bind this agent.</p>}
        </Card>

        <section className="space-y-2">
          {agents.length === 0 && <p className="text-sm text-muted-foreground">No agents yet.</p>}
          {agents.map((a) => (
            <Card key={a.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.display_name}</span>
                  <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                  <Badge variant="outline">rep {a.reputation_score}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  Key: <code>{a.api_key_prefix}…</code> · Cap: {a.max_spend_usdc_per_day} USDC/day
                </div>
              </div>
              <div className="flex gap-1">
                {a.status === "active" ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "paused")}><Pause className="w-4 h-4" /></Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "active")}><Play className="w-4 h-4" /></Button>
                )}
                <Button size="sm" variant="outline" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
        </section>

        {activity.length > 0 && (
          <section>
            <h2 className="font-semibold mb-2">Recent activity</h2>
            <Card className="divide-y divide-border">
              {activity.map((a) => (
                <div key={a.id} className="px-3 py-2 text-xs flex items-center justify-between">
                  <span className="font-mono">{a.method} {a.endpoint}</span>
                  <span className={a.status_code >= 400 ? "text-destructive" : "text-muted-foreground"}>
                    {a.status_code} · {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        )}
      </div>

      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save your API key</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is the only time you'll see this key. Store it somewhere safe.
          </p>
          <div className="bg-secondary rounded-lg p-3 font-mono text-xs break-all">{newKey}</div>
          <Button
            onClick={() => { if (newKey) { navigator.clipboard.writeText(newKey); toast.success("Copied"); } }}
            className="gap-2"
          >
            <Copy className="w-4 h-4" /> Copy
          </Button>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Agents;
