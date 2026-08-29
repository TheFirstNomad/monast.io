import { ArrowDownLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAINS } from "@/lib/chains";
import type { WalletActivityItem } from "@/lib/wallet/api";

const ARC = CHAINS["arc-testnet"];
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const stateLabel = (state: string | null) => {
  const s = String(state ?? "").toUpperCase();
  if (s === "COMPLETE" || s === "CONFIRMED") return "Completed";
  if (["FAILED", "CANCELLED", "DENIED", "EXPIRED"].includes(s)) return s.charAt(0) + s.slice(1).toLowerCase();
  return "Pending";
};

export const ActivityList = ({
  items,
  loading,
}: {
  items: WalletActivityItem[];
  loading: boolean;
}) => (
  <div className="bg-card border border-border rounded-xl p-5 space-y-3">
    <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>

    {loading ? (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    ) : items.length === 0 ? (
      <p className="text-xs text-muted-foreground">
        No transfers yet. Once you receive or send USDC it shows up here.
      </p>
    ) : (
      <ul className="divide-y divide-border/60">
        {items.map((t, i) => {
          const out = t.direction === "OUTBOUND";
          return (
            <li key={t.id ?? i} className="flex items-center gap-3 py-2.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  out ? "bg-destructive/10" : "bg-emerald-500/10"
                }`}
              >
                {out ? (
                  <ArrowUpRight className="w-4 h-4 text-destructive" />
                ) : (
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {out ? "Sent" : "Received"} {t.amountUsdc.toLocaleString()} USDC
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {t.counterparty ? (out ? `To ${short(t.counterparty)}` : `From ${short(t.counterparty)}`) : "Arc Testnet"}
                  {" · "}
                  {stateLabel(t.state)}
                  {t.createdAt ? ` · ${new Date(t.createdAt).toLocaleDateString()}` : ""}
                </div>
              </div>
              {t.txHash && (
                <a
                  href={`${ARC.explorer}/tx/${t.txHash}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="View transaction on ArcScan"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
