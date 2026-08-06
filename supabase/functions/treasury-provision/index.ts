// Owner-only treasury provisioning.
//
// Creates (once) a Circle developer-controlled wallet set, then one escrow wallet
// and one revenue wallet per requested chain, and records their addresses in
// treasury_wallets. Escrow funds and platform revenue are kept in separate
// wallets by design so they can never be commingled.
//
// GET  -> current treasury state (addresses, balances)
// POST -> provision missing wallets for the requested chain ids

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { verifyAdmin } from "../_shared/admin-auth.ts";
import { circleBlockchain, createWalletSet, createWallets, walletBalance } from "../_shared/circle-dev.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WALLET_SET_NAME = "monast.io treasury";
const DEFAULT_CHAINS = [5042002]; // Arc Testnet is the launch network.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    if (!(await verifyAdmin(req, admin))) return json({ error: "Forbidden" }, 403);

    if (req.method === "GET") {
      const { data: wallets } = await admin
        .from("treasury_wallets")
        .select("*")
        .order("chain_id")
        .order("purpose");

      const enriched = [];
      for (const w of wallets ?? []) {
        let usdc: string | null = null;
        if (w.circle_wallet_id) {
          try {
            const balances = await walletBalance(w.circle_wallet_id);
            usdc = balances.find((b) => b.token?.symbol?.toUpperCase().includes("USDC"))?.amount ?? "0";
          } catch (e) {
            console.error("balance lookup failed", w.id, (e as Error).message);
          }
        }
        enriched.push({ ...w, usdc_balance: usdc });
      }

      // Open escrow liability: what we owe buyers/sellers right now.
      const { data: open } = await admin
        .from("escrows")
        .select("chain_id, amount_usdc")
        .in("status", ["funded", "disputed"]);
      const liability: Record<number, number> = {};
      for (const e of open ?? []) {
        liability[e.chain_id] = (liability[e.chain_id] ?? 0) + Number(e.amount_usdc);
      }

      return json({ wallets: enriched, escrow_liability: liability });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => ({}));
    const rawChains = Array.isArray(body.chain_ids) && body.chain_ids.length
      ? body.chain_ids
      : DEFAULT_CHAINS;
    const chainIds = [...new Set(rawChains.map((c: unknown) => Number(c)))].filter(
      (c) => Number.isInteger(c) && c > 0,
    ) as number[];
    if (!chainIds.length) return json({ error: "chain_ids must be positive integers" }, 400);

    // Reuse the existing wallet set if one was already created.
    const { data: anyWallet } = await admin
      .from("treasury_wallets")
      .select("circle_wallet_set_id")
      .not("circle_wallet_set_id", "is", null)
      .limit(1)
      .maybeSingle();

    let walletSetId = anyWallet?.circle_wallet_set_id as string | undefined;
    if (!walletSetId) {
      const set = await createWalletSet(WALLET_SET_NAME);
      walletSetId = set.id;
    }

    const created: unknown[] = [];
    for (const chainId of chainIds) {
      const blockchain = circleBlockchain(chainId);
      for (const purpose of ["escrow", "revenue"] as const) {
        const { data: existing } = await admin
          .from("treasury_wallets")
          .select("id, address")
          .eq("purpose", purpose)
          .eq("chain_id", chainId)
          .maybeSingle();
        if (existing) {
          created.push({ chainId, purpose, address: existing.address, reused: true });
          continue;
        }

        const wallets = await createWallets(walletSetId!, [blockchain], 1);
        const w = wallets[0];
        if (!w?.address) throw new Error(`Circle returned no wallet for ${blockchain}`);

        const { error: insErr } = await admin.from("treasury_wallets").insert({
          purpose,
          chain_id: chainId,
          circle_blockchain: blockchain,
          circle_wallet_id: w.id,
          circle_wallet_set_id: walletSetId,
          address: w.address,
          is_active: true,
        });
        if (insErr) throw insErr;
        created.push({ chainId, purpose, address: w.address, reused: false });
      }
    }

    return json({ wallet_set_id: walletSetId, wallets: created });
  } catch (e) {
    console.error("treasury-provision", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
