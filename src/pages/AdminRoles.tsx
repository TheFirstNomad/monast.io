import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/hooks/useWallet";
import { getAdminAuthHeaders } from "@/lib/adminAuth";
import { useSeo } from "@/hooks/useSeo";
import { toast } from "sonner";
import { useSignMessage } from "wagmi";
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck, UserCog, Wallet } from "lucide-react";

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

const ROLES = ["arbitrator", "moderator", "admin"] as const;

interface RoleRow {
  id: string;
  user_id: string;
  role: string;
  granted_at: string;
  email: string | null;
}

/**
 * Owner-only role console. Authorised by a fresh owner-wallet signature rather
 * than a role, because this is where roles come from in the first place.
 */
const AdminRoles = () => {
  const { address, connect } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("arbitrator");
  const [busy, setBusy] = useState(false);

  useSeo({
    title: "Roles console | monast.io",
    description: "Owner-only role management for monast.io.",
    noindex: true,
  });

  const callAdmin = useCallback(
    async (body: Record<string, unknown>) => {
      if (!address) throw new Error("Connect the owner wallet first");
      const headers = await getAdminAuthHeaders(address, signMessageAsync as any);
      const res = await fetch(`${FUNCTIONS_BASE}/admin-roles`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(
          `This wallet (${address.slice(0, 6)}…${address.slice(-4)}) is not the owner wallet. Switch to the owner wallet to manage roles.`,
        );
      }
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      return data;
    },
    [address, signMessageAsync],
  );

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const data = await callAdmin({ action: "list" });
      setRows(data.roles ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address, callAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const grant = async () => {
    if (!email.trim()) return toast.error("Enter the account email");
    setBusy(true);
    try {
      await callAdmin({ action: "grant", email: email.trim(), role });
      toast.success(`${role} granted to ${email.trim()}`);
      setEmail("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (r: RoleRow) => {
    setBusy(true);
    try {
      await callAdmin({ action: "revoke", user_id: r.user_id, role: r.role });
      toast.success("Role revoked");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!address) {
    return (
      <Layout>
        <div className="container max-w-lg py-20 text-center space-y-4">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Owner access only</h1>
          <p className="text-muted-foreground">
            Connect the owner wallet to appoint arbitrators and moderators.
          </p>
          <Button onClick={connect} className="gap-2">
            <Wallet className="h-4 w-4" />
            Connect wallet
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-3xl py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCog className="h-6 w-6 text-primary" />
              Roles console
            </h1>
            <p className="text-sm text-muted-foreground">
              Arbitrators resolve disputes and move funds. Grant sparingly.
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

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Grant a role</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-2">
              <Label>Account email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={grant} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Grant
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Wallet-only accounts use their generated @wallet.monast.io email.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {rows.length === 0 && !loading && (
            <p className="p-8 text-center text-muted-foreground">No roles granted yet.</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.email ?? r.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  granted {new Date(r.granted_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{r.role}</Badge>
                <Button size="sm" variant="ghost" onClick={() => revoke(r)} disabled={busy}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default AdminRoles;
