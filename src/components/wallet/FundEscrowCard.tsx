import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EscrowFundButton } from "@/components/EscrowFundButton";
import { supabase } from "@/integrations/supabase/client";
import { splitSale, SALE_FEE_LABEL } from "@/lib/fees";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, Loader2, Clock } from "lucide-react";

interface Props {
  userId: string;
  balance: number | null;
  /** Refresh the live balance/activity once a deposit or release lands. */
  onFunded: () => void;
}

interface EscrowRow {
  id: string;
  amount_usdc: number;
  ad_id: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  payout_status: string | null;
  auto_release_at: string | null;
  title: string | null;
}

/**
 * Walks the whole escrow flow from the wallet page: fund a purchase with the
 * same path the escrow detail screen uses (self-custody signs locally, a
 * monast/Circle wallet signs through Circle), then confirm delivery so the
 * funds release. Rows poll so status and payout changes show up live next to
 * the balance.
 */
export const FundEscrowCard = ({ userId, balance, onFunded }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);

  const escrowsQuery = useQuery({
    queryKey: ["wallet-escrows", userId],
    queryFn: async (): Promise<EscrowRow[]> => {
      const { data } = await supabase
        .from("escrows")
        .select(
          "id, amount_usdc, ad_id, status, buyer_id, seller_id, payout_status, auto_release_at",
        )
        .in("status", ["created", "funded", "disputed"])
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      if (!rows.length) return [];
      const { data: ads } = await supabase
        .from("ads")
        .select("id, title")
        .in("id", [...new Set(rows.map((r: any) => r.ad_id))]);
      const titles = new Map((ads ?? []).map((a: any) => [a.id, a.title as string]));
      return rows.map((r: any) => ({
        ...r,
        amount_usdc: Number(r.amount_usdc),
        title: titles.get(r.ad_id) ?? null,
      }));
    },
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const all = escrowsQuery.data ?? [];
  const awaitingPayment = all.filter((e) => e.status === "created" && e.buyer_id === userId);
  const live = all.filter((e) => e.status === "funded" || e.status === "disputed");

  const active = useMemo(
    () => awaitingPayment.find((e) => e.id === selected) ?? awaitingPayment[0] ?? null,
    [awaitingPayment, selected],
  );
  const shortOfFunds = active && balance !== null && balance < active.amount_usdc;

  const release = async (id: string) => {
    setReleasing(id);
    const { data, error } = await supabase.functions.invoke("escrow-release", {
      body: { escrow_id: id },
    });
    setReleasing(null);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Funds released to the seller");
    await escrowsQuery.refetch();
    onFunded();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" /> Escrow
        </h2>
        <p className="text-xs text-muted-foreground">
          Pay for a purchase from this wallet, then release the funds once the item checks out.
        </p>
      </div>

      {/* Step 1 - fund */}
      {escrowsQuery.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : !awaitingPayment.length ? (
        <p className="text-xs text-muted-foreground">
          Nothing awaiting payment. Start a purchase from any{" "}
          <Link to="/browse" className="text-primary hover:underline">
            listing
          </Link>{" "}
          and it will show up here.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="escrowPick">Awaiting payment</Label>
            <Select value={active?.id} onValueChange={setSelected}>
              <SelectTrigger id="escrowPick">
                <SelectValue placeholder="Choose an escrow" />
              </SelectTrigger>
              <SelectContent>
                {awaitingPayment.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {(e.title ?? "Purchase")} · {e.amount_usdc.toLocaleString()} USDC
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {active && (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Amount due</span>
                <span className="font-semibold text-foreground">
                  {active.amount_usdc.toLocaleString()} USDC
                </span>
              </div>
              {shortOfFunds && (
                <p className="text-xs text-destructive">
                  Your balance is lower than the amount due. Receive USDC first.
                </p>
              )}
              <EscrowFundButton
                key={active.id}
                escrowId={active.id}
                amount={active.amount_usdc}
                onFunded={() => {
                  escrowsQuery.refetch();
                  onFunded();
                }}
              />
              <Link
                to={`/escrow/${active.id}`}
                className="block text-xs text-primary hover:underline text-center"
              >
                View escrow details
              </Link>
            </>
          )}
        </div>
      )}

      {/* Step 2 - release */}
      {!!live.length && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-medium text-foreground">In escrow now</p>
          {live.map((e) => {
            const isBuyer = e.buyer_id === userId;
            const net =
              splitSale(e.amount_usdc).sellerNet;
            const payoutBusy = e.payout_status === "pending" || e.payout_status === "processing";
            return (
              <div key={e.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <Link to={`/escrow/${e.id}`} className="font-medium text-foreground hover:underline truncate">
                    {e.title ?? "Purchase"}
                  </Link>
                  <span className="font-mono shrink-0">{e.amount_usdc.toLocaleString()} USDC</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isBuyer
                    ? `Release sends ${net.toLocaleString()} USDC to the seller (${SALE_FEE_LABEL} platform fee).`
                    : `You receive ${net.toLocaleString()} USDC in this wallet once the buyer confirms.`}
                </p>
                {e.auto_release_at && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Auto-releases {new Date(e.auto_release_at).toLocaleDateString()}
                  </p>
                )}
                {payoutBusy ? (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Payout in progress…
                  </p>
                ) : isBuyer ? (
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={releasing === e.id}
                    onClick={() => release(e.id)}
                  >
                    {releasing === e.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Confirm and release
                  </Button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Awaiting buyer confirmation.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
