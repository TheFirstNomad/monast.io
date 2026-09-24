import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/functionErrors";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Summary {
  overview: string;
  buyer_obligations: string[];
  seller_obligations: string[];
  ambiguities: { issue: string; suggestion: string }[];
}

export const EscrowTermsSummary = ({ escrowId }: { escrowId: string }) => {
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("escrow-terms-summary", {
      body: { escrow_id: escrowId, terms },
    });
    setLoading(false);
    if (error || data?.error) {
      const msg = data?.error ?? (await getFunctionErrorMessage(error, "Could not summarize the terms"));
      setError(msg);
      toast.error(msg);
      return;
    }
    setSummary(data.summary as Summary);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">Explain the deal terms</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Paste what you and the other side agreed on. AI turns it into a plain-language list of who must do what, and points out anything unclear. This is not legal advice.
      </p>
      <Textarea
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        placeholder="e.g. Seller transfers the domain within 48 hours of funding and sends the auth code in chat…"
        rows={5}
        maxLength={8000}
      />
      <Button onClick={run} disabled={loading || terms.trim().length < 20} className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {loading ? "Reading the terms…" : "Summarize terms"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {summary && (
        <div className="space-y-4 pt-2 text-sm">
          <p>{summary.overview}</p>
          <List title="Buyer must" items={summary.buyer_obligations} />
          <List title="Seller must" items={summary.seller_obligations} />
          {summary.ambiguities.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" /> Unclear points to agree on
              </h3>
              <ul className="space-y-2">
                {summary.ambiguities.map((a, i) => (
                  <li key={i} className="rounded-lg border border-border bg-secondary/40 p-3">
                    <span className="block">{a.issue}</span>
                    <span className="block text-muted-foreground mt-1">Suggestion: {a.suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const List = ({ title, items }: { title: string; items: string[] }) =>
  items.length ? (
    <div>
      <h3 className="font-medium mb-1">{title}</h3>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  ) : null;
