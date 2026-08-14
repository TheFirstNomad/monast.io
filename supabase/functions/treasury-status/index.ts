// Owner-only treasury overview: the provisioned wallets, their live USDC
// balances from Circle, and how much of the escrow wallet is user money that is
// still owed (funded escrows) versus platform revenue.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { verifyAdmin } from "../_shared/admin-auth.ts";
import { walletBalance } from "../_shared/circle-dev.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    if (!(await verifyAdmin(req, admin))) return json({ error: "Forbidden" }, 403);

    const { data: wallets } = await admin
      .from("treasury_wallets")
      .select("id, purpose, chain_id, address, circle_wallet_id, circle_blockchain, created_at")
      .order("purpose");

    // Live balances, best-effort - a Circle hiccup should not blank the page.
    const withBalances = await Promise.all(
      (wallets ?? []).map(async (w: any) => {
        let usdc: number | null = null;
        let balanceError: string | null = null;
        if (w.circle_wallet_id) {
          try {
            const balances = await walletBalance(w.circle_wallet_id);
            usdc = Number(
              balances.find((b: any) => b.token?.symbol?.toUpperCase().includes("USDC"))?.amount ?? 0,
            );
          } catch (e) {
            balanceError = (e as Error).message;
          }
        }
        return { ...w, usdc_balance: usdc, balance_error: balanceError };
      }),
    );

    // Money that still belongs to buyers: every escrow currently holding funds.
    const { data: held } = await admin
      .from("escrows")
      .select("amount_usdc, status")
      .in("status", ["funded", "disputed"]);
    const escrowLiability = (held ?? []).reduce((s: number, r: any) => s + Number(r.amount_usdc), 0);

    // Lifetime platform revenue by source, from the ledger.
    const { data: fees } = await admin
      .from("ledger_entries")
      .select("kind, amount_usdc")
      .in("kind", ["platform_fee", "listing_fee", "promotion_fee", "revenue_withdrawal"]);
    const revenue = { platform_fee: 0, listing_fee: 0, promotion_fee: 0, revenue_withdrawal: 0 };
    for (const r of fees ?? []) {
      revenue[r.kind as keyof typeof revenue] += Number(r.amount_usdc);
    }

    return json({
      wallets: withBalances,
      provisioned: (wallets ?? []).length > 0,
      escrow_liability_usdc: Number(escrowLiability.toFixed(6)),
      revenue,
    });
  } catch (e) {
    console.error("treasury-status", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
