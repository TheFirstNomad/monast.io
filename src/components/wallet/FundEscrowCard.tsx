import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
import { ShieldCheck } from "lucide-react";

interface Props {
  userId: string;
  balance: number | null;
  /** Refresh the live balance/activity once a deposit lands. */
  onFunded: () => void;
}

interface PendingEscrow {
  id: string;
  amount_usdc: number;
  ad_id: string;
  title: string | null;
}

/**
 * Lets a buyer pay an escrow straight from the wallet page, using the same
 * funding path as the escrow detail screen (self-custody signs locally, a
 * monast/Circle wallet signs through Circle) so verification is unchanged.
 */
export const FundEscrowCard = ({ userId, balance, onFunded }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);

  const pending = useQuery({
    queryKey: ["wallet-pending-escrows", userId],
    queryFn: async (): Promise<PendingEscrow[]> => {
      const { data } = await supabase
        .from("escrows")
        .select("id, amount_usdc, ad_id")
        .eq("buyer_id", userId)
        .eq("status", "created")
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      if (!rows.length) return [];
      const { data: ads } = await supabase
        .from("ads")
        .select("id, title")
        .in("id", [...new Set(rows.map((r: any) => r.ad_id))]);
      const titles = new Map((ads ?? []).map((a: any) => [a.id, a.title as string]));
      return rows.map((r: any) => ({
        id: r.id,
        amount_usdc: Number(r.amount_usdc),
        ad_id: r.ad_id,
        title: titles.get(r.ad_id) ?? null,
      }));
    },
    refetchOnWindowFocus: true,
  });

  const escrows = pending.data ?? [];
  const active = useMemo(
    () => escrows.find((e) => e.id === selected) ?? escrows[0] ?? null,
    [escrows, selected],
  );
  const shortOfFunds = active && balance !== null && balance < active.amount_usdc;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" /> Fund an escrow
        </h2>
        <p className="text-xs text-muted-foreground">
          Pay for a purchase directly from this wallet. Funds are held in escrow until you confirm
          delivery.
        </p>
      </div>

      {pending.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : !escrows.length ? (
        <p className="text-xs text-muted-foreground">
          Nothing awaiting payment. Start a purchase from any{" "}
          <Link to="/browse" className="text-primary hover:underline">
            listing
          </Link>{" "}
          and it will show up here.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="escrowPick">Awaiting payment</Label>
            <Select value={active?.id} onValueChange={setSelected}>
              <SelectTrigger id="escrowPick">
                <SelectValue placeholder="Choose an escrow" />
              </SelectTrigger>
              <SelectContent>
                {escrows.map((e) => (
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
                  pending.refetch();
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
        </>
      )}
    </div>
  );
};
