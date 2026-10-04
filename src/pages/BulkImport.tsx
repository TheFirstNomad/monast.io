import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { useSeo } from "@/hooks/useSeo";
import { categories } from "@/lib/types";
import { toast } from "sonner";
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, X, ShieldAlert } from "lucide-react";

interface CsvRow {
  title: string;
  description: string;
  price_usdc: string;
  category: string;
  condition: string;
  error?: string;
}

const VALID_CATEGORIES = categories.map((c) => c.name);
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_PENDING_DRAFTS = 10;
const MAX_ROWS_PER_IMPORT = 50;

const TEMPLATE_CSV = `title,description,price_usdc,category,condition
"My App for Sale","A profitable SaaS app with 100 users","500","Apps","New"
"Bitcoin 2020 OG Domain","Aged domain 2020 reg — great for crypto brand","150","Domains","New"
"Freelance Logo Design","Professional logo design — 3 concepts 2 revisions","25","Services","New"`;

const parseCsv = (text: string): CsvRow[] => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

  // Hard cap: never parse more than MAX_ROWS_PER_IMPORT data rows
  const dataLines = lines.slice(1, MAX_ROWS_PER_IMPORT + 1);

  return dataLines.map((line) => {
    // CSV parse — handles quoted fields
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    fields.push(cur.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (fields[i] ?? "").replace(/^"|"$/g, "").trim(); });

    const result: CsvRow = {
      title: row.title ?? "",
      description: row.description ?? "",
      price_usdc: row.price_usdc ?? "",
      category: row.category ?? "",
      condition: row.condition ?? "Used",
    };

    // Validate — client-side, matches server RLS
    const errors: string[] = [];
    if (!result.title) {
      errors.push("title required");
    } else if (result.title.length > MAX_TITLE_LENGTH) {
      errors.push(`title too long (max ${MAX_TITLE_LENGTH} chars)`);
    }
    if (result.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`description too long (max ${MAX_DESCRIPTION_LENGTH} chars)`);
    }
    if (!result.price_usdc || isNaN(Number(result.price_usdc)) || Number(result.price_usdc) <= 0) {
      errors.push("invalid price");
    } else if (Number(result.price_usdc) > 10_000_000) {
      errors.push("price exceeds 10,000,000 USDC");
    }
    if (!VALID_CATEGORIES.includes(result.category)) {
      errors.push(`unknown category: "${result.category}"`);
    }
    if (errors.length) result.error = errors.join("; ");

    return result;
  });
};

const BulkImport = () => {
  useSeo({
    title: "monast.io | Bulk Import Listings",
    description: "Upload a CSV to create multiple listings at once on monast.io.",
    canonicalPath: "/bulk-import",
  });

  const { user, resolving } = useRequireAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const [pendingDraftCount, setPendingDraftCount] = useState<number | null>(null);
  const [checkingDrafts, setCheckingDrafts] = useState(false);

  // Check how many pending_fee drafts the user already has
  useEffect(() => {
    if (!user) return;
    setCheckingDrafts(true);
    supabase
      .from("ads")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "pending_fee")
      .then(({ count }) => {
        setPendingDraftCount(count ?? 0);
        setCheckingDrafts(false);
      });
  }, [user, done]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      setDone(false);
      // Warn if CSV was truncated
      const rawLines = text.trim().split("\n").length - 1; // subtract header
      if (rawLines > MAX_ROWS_PER_IMPORT) {
        toast.warning(`CSV has ${rawLines} rows — only the first ${MAX_ROWS_PER_IMPORT} were loaded. Split your file into batches of ${MAX_ROWS_PER_IMPORT}.`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "monast-bulk-template.csv";
    a.click();
  };

  const validRows = rows.filter((r) => !r.error);
  const invalidRows = rows.filter((r) => !!r.error);

  // Guard: block import if user already has too many unpublished drafts
  const draftLimitReached = pendingDraftCount !== null && pendingDraftCount >= MAX_PENDING_DRAFTS;

  const submit = async () => {
    if (!user || !validRows.length || draftLimitReached) return;
    setSubmitting(true);
    let ok = 0; let fail = 0;

    for (const row of validRows) {
      const { error } = await supabase.from("ads").insert({
        seller_id: user.id,
        title: row.title.slice(0, MAX_TITLE_LENGTH),
        description: row.description.slice(0, MAX_DESCRIPTION_LENGTH),
        price_usdc: Number(row.price_usdc),
        category: row.category,
        condition: row.condition || null,
        status: "pending_fee",
        images: [],
      });
      if (error) { fail++; } else { ok++; }
    }

    setResults({ ok, fail });
    setDone(true);
    setSubmitting(false);
    if (ok > 0) toast.success(`${ok} listing${ok > 1 ? "s" : ""} created — pay the listing fee to publish each one.`);
    if (fail > 0) toast.error(`${fail} listing${fail > 1 ? "s" : ""} failed to create.`);
  };

  if (resolving) return <AuthResolving />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <div>
          <h1 className="font-display text-4xl text-foreground">Bulk Import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV to create up to {MAX_ROWS_PER_IMPORT} listings at once. Listings start as{" "}
            <code className="bg-muted px-1 rounded text-xs">pending_fee</code> — pay each listing fee individually to publish.
          </p>
        </div>

        {/* Draft limit warning */}
        {!checkingDrafts && draftLimitReached && (
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Too many unpublished listings</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You have {pendingDraftCount} unpublished drafts. Publish or remove some before importing more.{" "}
                <a href="/dashboard" className="underline text-foreground hover:text-primary">Go to Dashboard</a>
              </p>
            </div>
          </div>
        )}

        {/* Per-session limits info */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Max rows per upload: <strong className="text-foreground">{MAX_ROWS_PER_IMPORT}</strong></span>
          <span>Max title length: <strong className="text-foreground">{MAX_TITLE_LENGTH} chars</strong></span>
          <span>Max description: <strong className="text-foreground">{MAX_DESCRIPTION_LENGTH} chars</strong></span>
          <span>Max unpublished drafts: <strong className="text-foreground">{MAX_PENDING_DRAFTS}</strong></span>
          {pendingDraftCount !== null && (
            <span>Your current drafts: <strong className={draftLimitReached ? "text-destructive" : "text-foreground"}>{pendingDraftCount}</strong></span>
          )}
        </div>

        {/* Upload area */}
        <div
          onClick={() => !draftLimitReached && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
            draftLimitReached
              ? "border-border opacity-40 cursor-not-allowed"
              : "border-border cursor-pointer hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Click to upload CSV</p>
          <p className="text-xs text-muted-foreground mt-1">Columns: title, description, price_usdc, category, condition</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} disabled={draftLimitReached} />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="w-4 h-4" /> Download template CSV
          </Button>
        </div>

        {/* Preview table */}
        {rows.length > 0 && !done && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">
                <span className="text-green-500 font-medium">{validRows.length} valid</span>
                {invalidRows.length > 0 && <span className="text-destructive font-medium ml-2">{invalidRows.length} invalid</span>}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setRows([])} className="gap-1 text-muted-foreground">
                <X className="w-4 h-4" /> Clear
              </Button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Title</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Price</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">Category</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`${i < rows.length - 1 ? "border-b border-border" : ""} ${r.error ? "bg-destructive/5" : ""}`}>
                      <td className="px-4 py-2.5 text-foreground truncate max-w-[200px]">{r.title || <span className="text-muted-foreground italic">empty</span>}</td>
                      <td className="px-4 py-2.5 text-right price-nums text-foreground">{r.price_usdc ? `${r.price_usdc} USDC` : "—"}</td>
                      <td className="px-4 py-2.5 text-foreground hidden sm:table-cell">{r.category || "—"}</td>
                      <td className="px-4 py-2.5">
                        {r.error
                          ? <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{r.error}</span>
                          : <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Ready</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validRows.length > 0 && (
              <Button onClick={submit} disabled={submitting || draftLimitReached} className="gap-2">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Creating {validRows.length} listings…</>
                  : `Create ${validRows.length} listing${validRows.length > 1 ? "s" : ""}`
                }
              </Button>
            )}
          </div>
        )}

        {/* Done state */}
        {done && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-semibold text-foreground">{results.ok} listing{results.ok > 1 ? "s" : ""} created</p>
            <p className="text-sm text-muted-foreground">Go to your Dashboard to pay each listing fee and publish.</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => { setRows([]); setDone(false); }}>Import more</Button>
              <Button asChild><a href="/dashboard">Go to Dashboard</a></Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BulkImport;
