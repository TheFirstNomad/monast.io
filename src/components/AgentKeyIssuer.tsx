import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, KeyRound, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

/**
 * AgentKeyIssuer — self-serve agent API key creation.
 * Calls the `agent-key-issue` Supabase Edge Function.
 * The plain key is shown once and must be copied immediately.
 * Additive — no existing component is changed.
 */
export const AgentKeyIssuer = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [maxSpend, setMaxSpend] = useState("100");
  const [loading, setLoading] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issue = async () => {
    if (!user) { toast.error("Sign in to create an agent key"); return; }
    const name = displayName.trim();
    const wallet = walletAddress.trim();
    if (!name) { toast.error("Display name is required"); return; }
    if (!wallet) { toast.error("Wallet address is required"); return; }
    const spend = Number(maxSpend);
    if (!Number.isFinite(spend) || spend < 0) { toast.error("Invalid spend cap"); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-key-issue", {
        body: { display_name: name, wallet_address: wallet, max_spend_usdc_per_day: spend },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Failed to create key");
        return;
      }
      setIssuedKey(data.api_key as string);
      setDisplayName("");
      setWalletAddress("");
      setMaxSpend("100");
      toast.success("Agent key created — copy it now");
    } finally {
      setLoading(false);
    }
  };

  const copyKey = async () => {
    if (!issuedKey) return;
    await navigator.clipboard.writeText(issuedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        Sign in to create an agent API key.
      </div>
    );
  }

  if (issuedKey) {
    return (
      <div className="rounded-xl border border-primary/40 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">Your new agent key</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary font-mono text-xs text-foreground break-all">
          <span className="flex-1">{issuedKey}</span>
          <button
            onClick={copyKey}
            className="shrink-0 p-1 hover:text-primary transition-colors"
            aria-label="Copy key"
          >
            {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-500 leading-relaxed">
            This key is shown once and cannot be retrieved again. Copy it and store it securely (e.g. in your agent environment variables as <code className="font-mono">MONAST_AGENT_KEY</code>).
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setIssuedKey(null)}>
          Create another key
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground">Create an agent key</span>
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="agent-name" className="text-xs text-muted-foreground mb-1 block">
            Agent name
          </Label>
          <Input
            id="agent-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. My Claude Buyer Agent"
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="agent-wallet" className="text-xs text-muted-foreground mb-1 block">
            Agent wallet address (Arc)
          </Label>
          <Input
            id="agent-wallet"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            The wallet your agent will use to pay and receive USDC on Arc.
          </p>
        </div>
        <div>
          <Label htmlFor="agent-spend" className="text-xs text-muted-foreground mb-1 block">
            Daily USDC spend cap
          </Label>
          <Input
            id="agent-spend"
            type="number"
            min="0"
            max="1000000"
            value={maxSpend}
            onChange={(e) => setMaxSpend(e.target.value)}
            placeholder="100"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Maximum USDC your agent can spend per day. You can update this later.
          </p>
        </div>
      </div>
      <Button onClick={issue} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        {loading ? "Creating key…" : "Create agent key"}
      </Button>
    </div>
  );
};
