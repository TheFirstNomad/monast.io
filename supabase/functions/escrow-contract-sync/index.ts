// Mirrors MonastEscrowV3 activity into Monast's records. The client sends a tx
// hash; we read the receipt from Arc Mainnet ourselves, keep only events emitted
// by the escrow contract, and check every party against the caller's wallets.
// Nothing here moves money - the contract already did.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { createPublicClient, http, decodeEventLog } from "npm:viem@2.21.0";
import abi from "../_shared/monastEscrowAbi.json" with { type: "json" };
import { arcMainnetRpc, ARC_MAINNET_CHAIN_ID } from "../_shared/arc-chains.ts";
import { notify } from "../_shared/notify.ts";
import { statusFromError } from "../_shared/http-error.ts";

const CONTRACT = "0xca19df99563fe93c6172463e4b66a3dcf2cf1eba";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const micros = (v: bigint) => Number(v) / 1e6;
const lc = (s: unknown) => String(s ?? "").toLowerCase();

async function persist(query: PromiseLike<{ error: any }>) {
  const { error } = await query;
  if (error) throw error;
}

async function walletsOf(admin: any, userId: string): Promise<Set<string>> {
  const out = new Set<string>();
  const { data: p } = await admin.from("profiles").select("wallet_address, circle_wallet_address").eq("id", userId).maybeSingle();
  if (p?.wallet_address) out.add(lc(p.wallet_address));
  if (p?.circle_wallet_address) out.add(lc(p.circle_wallet_address));
  const { data: ws } = await admin.from("user_wallets").select("address").eq("user_id", userId);
  for (const w of ws ?? []) out.add(lc(w.address));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await asUser.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const txHash = String(body.tx_hash ?? "");
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return json({ error: "Valid tx_hash required" }, 400);
    const adId = body.ad_id ? String(body.ad_id) : null;
    const escrowRowId = body.escrow_id ? String(body.escrow_id) : null;

    const client = createPublicClient({ transport: http(arcMainnetRpc()) });
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);
    if (!receipt) return json({ status: "confirming", error: "Transaction is still confirming" }, 202);
    if (receipt.status !== "success") return json({ error: "That transaction failed on-chain" }, 400);

    const events: Array<{ eventName: string; args: any }> = [];
    for (const log of receipt.logs) {
      if (lc(log.address) !== CONTRACT) continue;
      try { events.push(decodeEventLog({ abi: abi as any, data: log.data, topics: log.topics }) as any); } catch { /* not ours */ }
    }
    if (!events.length) return json({ error: "No Monast escrow activity in that transaction" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const mine = await walletsOf(admin, userId);
    const applied: string[] = [];

    for (const ev of events) {
      const a = ev.args;
      if (ev.eventName === "ListingCreated") {
        if (!adId) continue;
        const { data: ad } = await admin.from("ads").select("id, seller_id, price_usdc, status, onchain_listing_id").eq("id", adId).maybeSingle();
        if (!ad || ad.seller_id !== userId) return json({ error: "Not your listing" }, 403);
        if (!mine.has(lc(a.seller))) return json({ error: "The listing was created from a wallet that is not on your account" }, 403);
        if (BigInt(Math.round(Number(ad.price_usdc) * 1e6)) !== BigInt(a.priceUsdc))
          return json({ error: "On-chain price does not match the listing price" }, 400);
        const patch: Record<string, unknown> = {
          onchain_listing_id: lc(a.listingId),
          listing_fee_tx_hash: lc(txHash),
          listing_fee_paid_at: new Date().toISOString(),
          listing_fee_chain_id: ARC_MAINNET_CHAIN_ID,
        };
        if (ad.status === "pending_fee") patch.status = "active";
        const { error } = await admin.from("ads").update(patch).eq("id", adId);
        if (error) throw error;
        applied.push("listing");
      } else if (ev.eventName === "EscrowFunded") {
        if (!escrowRowId) continue;
        const { data: esc } = await admin.from("escrows").select("*").eq("id", escrowRowId).maybeSingle();
        if (!esc || esc.buyer_id !== userId) return json({ error: "Not your escrow" }, 403);
        if (esc.status !== "created" && lc(esc.onchain_escrow_id) !== lc(a.escrowId))
          return json({ error: `Escrow is already ${esc.status}` }, 400);
        // Recover a mined payment without rewinding a released/refunded escrow.
        if (lc(esc.onchain_escrow_id) === lc(a.escrowId) && esc.status !== "created") {
          applied.push("funded");
          continue;
        }
        const { data: ad } = await admin.from("ads").select("onchain_listing_id").eq("id", esc.ad_id).maybeSingle();
        if (lc(ad?.onchain_listing_id) !== lc(a.listingId)) return json({ error: "Funded a different listing" }, 400);
        if (!mine.has(lc(a.buyer))) return json({ error: "Funded from a wallet that is not on your account" }, 403);
        if (BigInt(a.amount) < BigInt(Math.round(Number(esc.amount_usdc) * 1e6)))
          return json({ error: "Funded amount is below the escrow amount" }, 400);
        await persist(admin.from("escrows").update({
          settlement: "contract",
          onchain_escrow_id: lc(a.escrowId),
          deposit_tx_hash: lc(txHash),
          amount_usdc: micros(BigInt(a.amount)),
          status: "funded",
          funded_at: new Date().toISOString(),
          auto_release_at: null,
          chain_id: ARC_MAINNET_CHAIN_ID,
        }).eq("id", esc.id));
        await persist(admin.from("ads").update({ status: "reserved" }).eq("id", esc.ad_id).eq("status", "active"));
        await notify({ userId: esc.seller_id, kind: "escrow_funded", title: "Buyer funded the escrow", body: "USDC is locked in the Monast escrow contract. Deliver the item, then mark it delivered.", link: `/escrow/${esc.id}` });
        applied.push("funded");
      } else {
        const id = lc(a.escrowId);
        if (!id) continue;
        const { data: esc } = await admin.from("escrows").select("*").ilike("onchain_escrow_id", id).maybeSingle();
        if (!esc) continue;
        if (esc.buyer_id !== userId && esc.seller_id !== userId) return json({ error: "Not your escrow" }, 403);
        const now = new Date().toISOString();
        const released = ev.eventName === "EscrowReleased" || ev.eventName === "EscrowAutoReleased" ||
          (ev.eventName === "EscrowArbitrated" && !a.releaseToBuyer);
        const refunded = ev.eventName === "EscrowRefunded" || (ev.eventName === "EscrowArbitrated" && a.releaseToBuyer);
        if (released) {
          await persist(admin.from("escrows").update({
            status: "released", released_at: now, release_tx_hash: lc(txHash), payout_status: "confirmed",
            seller_net_usdc: micros(BigInt(a.sellerNet ?? 0)), platform_fee_usdc: micros(BigInt(a.fee ?? 0)),
          }).eq("id", esc.id));
          await persist(admin.from("ads").update({ status: "sold", sold_at: now }).eq("id", esc.ad_id));
          if (esc.deposit_tx_hash) {
            const { data: payment, error: paymentError } = await admin.from("payments").select("id").eq("tx_hash", esc.deposit_tx_hash).maybeSingle();
            if (paymentError) throw paymentError;
            if (!payment) await persist(admin.from("payments").insert({ ad_id: esc.ad_id, buyer_id: esc.buyer_id, seller_id: esc.seller_id, amount_usdc: esc.amount_usdc, tx_hash: esc.deposit_tx_hash, chain_id: esc.chain_id }));
          }
          if (esc.status !== "released") await notify({ userId: esc.seller_id, kind: "escrow_released", title: "Escrow released to you", body: "Open the escrow page and tap Withdraw to move the USDC to your wallet.", link: `/escrow/${esc.id}` });
          applied.push("released");
        } else if (refunded) {
          await persist(admin.from("escrows").update({ status: "refunded", refunded_at: now, refund_tx_hash: lc(txHash), payout_status: "confirmed" }).eq("id", esc.id));
          await persist(admin.from("ads").update({ status: "active" }).eq("id", esc.ad_id).eq("status", "reserved"));
          if (esc.status !== "refunded") await notify({ userId: esc.buyer_id, kind: "escrow_refunded", title: "Escrow refunded in full", body: "Open the escrow page and tap Withdraw to move the USDC to your wallet.", link: `/escrow/${esc.id}` });
          applied.push("refunded");
        } else if (ev.eventName === "DisputeOpened" && esc.status === "funded") {
          await persist(admin.from("escrows").update({ status: "disputed" }).eq("id", esc.id));
          applied.push("disputed");
        } else if (ev.eventName === "ReadyForRelease" && !esc.delivery_marked_at) {
          await persist(admin.from("escrows").update({ delivery_marked_at: now, auto_release_at: new Date(Number(a.readyAt) * 1000).toISOString() }).eq("id", esc.id));
          applied.push("delivered");
        } else if (ev.eventName === "DisputeOpened" && esc.status === "disputed") {
          applied.push("disputed");
        } else if (ev.eventName === "ReadyForRelease" && esc.delivery_marked_at) {
          applied.push("delivered");
        }
      }
    }
    return json({ ok: true, applied });
  } catch (e) {
    console.error("escrow-contract-sync", e);
    return json({ error: (e as Error).message }, statusFromError(e));
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
