import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { useSeo } from "@/hooks/useSeo";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Flag, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type Status = "open" | "reviewing" | "actioned" | "dismissed";

interface Report {
  id: string;
  reporter_id: string;
  target_type: "ad" | "profile" | "escrow";
  target_id: string;
  reason: string;
  details: string | null;
  status: Status;
  reviewer_notes: string | null;
  created_at: string;
}

const TABS: Status[] = ["open", "reviewing", "actioned", "dismissed"];

const targetLink = (r: Report) =>
  r.target_type === "ad"
    ? `/ad/${r.target_id}`
    : r.target_type === "profile"
      ? `/seller/${r.target_id}`
      : `/escrow/${r.target_id}`;

/** Moderator-only abuse queue with a takedown action for listings. */
const AdminReports = () => {
  const { user } = useAuth();
  const { isModerator, loading: rolesLoading } = useRoles();
  const [tab, setTab] = useState<Status>("open");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useSeo({
    title: "Moderation queue | monast.io",
    description: "Moderator-only abuse report queue.",
    noindex: true,
  });

  const load = useCallback(async () => {
    if (!isModerator) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setReports((data ?? []) as Report[]);
    setLoading(false);
  }, [isModerator, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (r: Report, status: Status, takedown = false) => {
    setBusy(r.id + status);
    if (takedown && r.target_type === "ad") {
      const { error: adErr } = await supabase
        .from("ads")
        .update({ status: "removed" })
        .eq("id", r.target_id);
      if (adErr) {
        setBusy(null);
        toast.error(`Takedown failed: ${adErr.message}`);
        return;
      }
    }
    const { error } = await supabase
      .from("reports")
      .update({
        status,
        reviewer_id: user?.id ?? null,
        reviewer_notes: notes[r.id]?.trim() || r.reviewer_notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(takedown ? "Listing removed and report closed" : `Report marked ${status}`);
    load();
  };

  if (!rolesLoading && (!user || !isModerator)) {
    return (
      <Layout>
        <div className="container max-w-2xl py-20 text-center space-y-4">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Moderators only</h1>
          <p className="text-muted-foreground">
            This queue needs the moderator or arbitrator role. Ask the platform owner to grant it.
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
              <Flag className="h-6 w-6 text-primary" />
              Moderation queue
            </h1>
            <p className="text-sm text-muted-foreground">Abuse reports on listings, profiles and escrows.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
              {t}
            </Button>
          ))}
        </div>

        {!loading && reports.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            Nothing {tab} right now.
          </div>
        )}

        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {r.target_type} · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
            </div>

            {r.details && <p className="text-sm text-muted-foreground">{r.details}</p>}

            <Button variant="ghost" size="sm" asChild className="px-0">
              <Link to={targetLink(r)}>View reported {r.target_type}</Link>
            </Button>

            <Textarea
              rows={2}
              placeholder="Reviewer notes"
              value={notes[r.id] ?? r.reviewer_notes ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            />

            <div className="flex flex-wrap gap-2">
              {r.status === "open" && (
                <Button size="sm" variant="secondary" onClick={() => review(r, "reviewing")} disabled={busy !== null}>
                  {busy === r.id + "reviewing" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Start review
                </Button>
              )}
              {r.target_type === "ad" && (
                <Button size="sm" variant="destructive" onClick={() => review(r, "actioned", true)} disabled={busy !== null}>
                  {busy === r.id + "actioned" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Remove listing
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => review(r, "actioned")} disabled={busy !== null}>
                Mark actioned
              </Button>
              <Button size="sm" variant="ghost" onClick={() => review(r, "dismissed")} disabled={busy !== null}>
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default AdminReports;
