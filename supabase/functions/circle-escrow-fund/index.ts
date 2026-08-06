// Funds an escrow from the buyer's Circle User-Controlled Wallet.
// Creates a Circle USDC transfer challenge to the marketplace treasury.
// The PIN entry happens client-side inside the Circle Web SDK overlay; this
// function only mints the userToken and the challenge.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getTreasury, isTreasuryMissing } from "../_shared/treasury.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CIRCLE_BASE = "https://api.circle.com/v1/w3s";
const CIRCLE_API_KEY = Deno.env.get("CIRCLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Circle blockchain id -> { evm chain id, USDC token contract }
const CIRCLE_CHAINS: Record<string, { chainId: number; usdc: string }> = {
  "BASE-SEPOLIA": { chainId: 84532, usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
  "ETH-SEPOLIA": { chainId: 11155111, usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  "ARB-SEPOLIA": { chainId: 421614, usdc: "0x75faF114eafb1BDbe2F0316DF893fd58CE46AA4d" },
};

async function circle(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CIRCLE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Circle ${path} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await asUser.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const escrowId = String(body.escrow_id ?? "");
    const blockchain = String(body.blockchain ?? "BASE-SEPOLIA").toUpperCase();
    if (!escrowId) return json({ error: "escrow_id required" }, 400);
    const chainConf = CIRCLE_CHAINS[blockchain];
    if (!chainConf) return json({ error: `Unsupported blockchain ${blockchain}` }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowId).maybeSingle();
    if (!esc) return json({ error: "Escrow not found" }, 404);
    if (esc.buyer_id !== userId) return json({ error: "Not your escrow" }, 403);
    if (esc.status !== "created") return json({ error: `Escrow already ${esc.status}` }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("circle_user_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.circle_user_id) {
      return json({ error: "No Circle wallet on this account. Finish wallet setup first." }, 400);
    }

    // Mint a user token for the SDK + wallet lookup.
    const tokenRes = await circle("/users/token", {
      method: "POST",
      body: JSON.stringify({ userId: profile.circle_user_id }),
    });
    const userToken: string = tokenRes.data.userToken;
    const encryptionKey: string = tokenRes.data.encryptionKey;

    const walletsRes = await circle(`/wallets?userId=${profile.circle_user_id}`, {
      method: "GET",
      headers: { "X-User-Token": userToken },
    });
    const wallets = walletsRes?.data?.wallets ?? [];
    const wallet = wallets.find((w: any) => w.blockchain === blockchain) ?? wallets[0];
    if (!wallet) return json({ error: "No Circle wallet found for this chain" }, 400);

    const amount = Number(esc.amount_usdc);
    const txRes = await circle("/user/transactions/transfer", {
      method: "POST",
      headers: { "X-User-Token": userToken },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        walletId: wallet.id,
        destinationAddress: ESCROW_TREASURY,
        tokenAddress: chainConf.usdc,
        blockchain,
        amounts: [amount.toString()],
        feeLevel: "MEDIUM",
      }),
    });

    // Track the chain the deposit will actually land on so verification matches.
    if (esc.chain_id !== chainConf.chainId) {
      await admin.from("escrows").update({ chain_id: chainConf.chainId }).eq("id", escrowId);
    }

    return json({
      userToken,
      encryptionKey,
      challengeId: txRes.data.challengeId,
      transactionId: txRes.data.id ?? null,
      blockchain,
      chain_id: chainConf.chainId,
    });
  } catch (e) {
    console.error("circle-escrow-fund", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
