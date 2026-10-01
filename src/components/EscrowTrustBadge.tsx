import { ShieldCheck, LockKeyhole, RefreshCcw, ExternalLink } from "lucide-react";

/**
 * EscrowTrustBadge — explains the trustless escrow model to first-time buyers.
 * Placed on the listing detail page below the buy card.
 * Additive only — no existing component is changed.
 */
export const EscrowTrustBadge = () => (
  <div className="bg-card rounded-xl border border-border p-5">
    <div className="flex items-center gap-2 mb-4">
      <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
      <span className="text-xs font-semibold text-foreground">How buyer protection works</span>
    </div>
    <ol className="space-y-3">
      <li className="flex items-start gap-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">1</span>
        <div>
          <p className="text-xs font-medium text-foreground">You send USDC to escrow</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            Your payment goes into a protected escrow account on Arc, not directly to the seller. Monast never holds it.
          </p>
        </div>
      </li>
      <li className="flex items-start gap-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">2</span>
        <div>
          <p className="text-xs font-medium text-foreground">Seller delivers</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            The seller fulfils the order. Funds stay locked until you confirm receipt — the seller cannot touch them before that.
          </p>
        </div>
      </li>
      <li className="flex items-start gap-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">3</span>
        <div>
          <p className="text-xs font-medium text-foreground">You confirm, funds release</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            Once you confirm delivery, USDC transfers to the seller instantly on Arc. Dispute? Open a case and an arbitrator steps in.
          </p>
        </div>
      </li>
    </ol>
    <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <LockKeyhole className="w-3 h-3 shrink-0 text-primary" />
        <span>Funds held on Arc — the blockchain enforces release, not Monast staff</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <RefreshCcw className="w-3 h-3 shrink-0 text-primary" />
        <span>Full refund if seller fails to deliver and you raise a dispute</span>
      </div>
      <a
        href="/agent-docs"
        className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
      >
        <ExternalLink className="w-3 h-3" />
        How escrow works in detail
      </a>
    </div>
  </div>
);
