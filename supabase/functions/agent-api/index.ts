// Agent API router - all marketplace actions exposed for AI agents.
import {
  authenticateAgent, checkRateLimit, corsHeaders, json, logActivity,
  svcClient, todaySpendUsdc,
} from "../_shared/agent-auth.ts";
import { verifyUsdcTransfer } from "../_shared/tx-verify.ts";

const BASE = "/agent-api";

function strip(path: string): string {
  const i = path.indexOf(BASE);
  return i >= 0 ? path.slice(i + BASE.length) || "/" : path;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const route = strip(url.pathname);
  const method = req.method;
  const svc = svcClient();

  const agent = await authenticateAgent(req, svc);
  if (!agent) return json({ error: "invalid_api_key" }, 401);

  const rl = await checkRateLimit(svc, agent.id, route, method);
  if (!rl.ok) {
    await logActivity(svc, agent.id, route, method, 429, { used: rl.used, limit: rl.limit });
    return json({ error: "rate_limited", limit: rl.limit, used: rl.used }, 429);
  }

  let status = 200;
  let body: unknown = { error: "not_found" };

  try {
    // /me
    if (route === "/me" && method === "GET") {
      const spent = await todaySpendUsdc(svc, agent.wallet_address, agent.owner_user_id);
      body = {
        id: agent.id, display_name: agent.display_name, kind: agent.kind,
        wallet_address: agent.wallet_address, reputation_score: agent.reputation_score,
        max_spend_usdc_per_day: Number(agent.max_spend_usdc_per_day),
        spent_today_usdc: spent,
        remaining_today_usdc: Math.max(0, Number(agent.max_spend_usdc_per_day) - spent),
      };
    }

    // /ads
    else if (route === "/ads" && method === "GET") {
      const q = url.searchParams.get("q");
      const category = url.searchParams.get("category");
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
      let qb = svc.from("ads").select("id,title,description,category,condition,location,price_usdc,images,seller_id,created_at")
        .eq("status", "active").order("created_at", { ascending: false }).limit(limit);
      if (q) qb = qb.ilike("title", `%${q}%`);
      if (category) qb = qb.eq("category", category);
      const { data, error } = await qb;
      if (error) { status = 400; body = { error: error.message }; }
      else body = { ads: data };
    }

    // /ads/:id
    else if (method === "GET" && route.startsWith("/ads/")) {
      const id = route.slice(5);
      const { data, error } = await svc.from("ads")
        .select("*, seller:profiles!ads_seller_id_fkey(display_name, wallet_address, rating, total_ads)")
        .eq("id", id).maybeSingle();
      // Enforce the same visibility rule as the public RLS policy: published
      // ads only, unless the caller's own user is the seller.
      const visible = data && (
        ["active", "reserved", "sold"].includes(String((data as any).status)) ||
        (agent.owner_user_id && (data as any).seller_id === agent.owner_user_id)
      );
      if (error) { status = 400; body = { error: error.message }; }
      else if (!visible) { status = 404; body = { error: "not_found" }; }
      else body = data;
    }


    // /offers GET
    else if (route === "/offers" && method === "GET") {
      if (!agent.owner_user_id) { status = 400; body = { error: "standalone agents have no offer history yet" }; }
      else {
        const { data, error } = await svc.from("offers")
          .select("*, ad:ads!offers_ad_id_fkey(title, price_usdc, seller_id)")
          .or(`buyer_id.eq.${agent.owner_user_id},ad.seller_id.eq.${agent.owner_user_id}`)
          .order("created_at", { ascending: false }).limit(100);
        if (error) { status = 400; body = { error: error.message }; }
        else body = { offers: data };
      }
    }

    // /offers POST  (buyer agent creates offer)
    else if (route === "/offers" && method === "POST") {
      if (!agent.owner_user_id) { status = 400; body = { error: "standalone agents cannot create offers yet" }; }
      else {
        const b = await req.json().catch(() => ({}));
        const adId = String(b?.ad_id ?? "");
        const amount = Number(b?.amount_usdc);
        if (!adId || !Number.isFinite(amount) || amount <= 0) {
          status = 400; body = { error: "ad_id and positive amount_usdc required" };
        } else {
          const spent = await todaySpendUsdc(svc, agent.wallet_address, agent.owner_user_id);
          if (spent + amount > Number(agent.max_spend_usdc_per_day)) {
            status = 402; body = { error: "spend_cap_exceeded", spent_today_usdc: spent, max: Number(agent.max_spend_usdc_per_day) };
          } else {
            const { data, error } = await svc.from("offers").insert({
              ad_id: adId, buyer_id: agent.owner_user_id, amount_usdc: amount,
            }).select("*").single();
            if (error) { status = 400; body = { error: error.message }; }
            else body = data;
          }
        }
      }
    }

    // /offers/:id/accept - only the ad's seller may accept, and only pending offers.
    else if (method === "POST" && route.match(/^\/offers\/[^/]+\/accept$/)) {
      const id = route.split("/")[2];
      if (!agent.owner_user_id) { status = 403; body = { error: "standalone agents cannot accept offers" }; }
      else {
        const { data: offer } = await svc.from("offers")
          .select("id, status, ad_id, ad:ads!offers_ad_id_fkey(seller_id)")
          .eq("id", id).maybeSingle();
        const sellerId = (offer as any)?.ad?.seller_id;
        if (!offer) { status = 404; body = { error: "offer_not_found" }; }
        else if (sellerId !== agent.owner_user_id) { status = 403; body = { error: "only the ad's seller can accept this offer" }; }
        else if (offer.status !== "pending") { status = 409; body = { error: "offer is not pending" }; }
        else {
          const { data, error } = await svc.from("offers").update({ status: "accepted" }).eq("id", id).select("*").single();
          if (error) { status = 400; body = { error: error.message }; }
          else body = data;
        }
      }
    }

    // /offers/:id/cancel
    else if (method === "POST" && route.match(/^\/offers\/[^/]+\/cancel$/)) {
      const id = route.split("/")[2];
      if (!agent.owner_user_id) { status = 400; body = { error: "standalone agents cannot cancel offers" }; }
      else {
        const { data, error } = await svc.from("offers")
          .update({ status: "cancelled" }).eq("id", id).eq("buyer_id", agent.owner_user_id).select("*").single();
        if (error) { status = 400; body = { error: error.message }; }
        else body = data;
      }
    }

    // /payments POST - verified on-chain before recording.
    else if (route === "/payments" && method === "POST") {
      if (!agent.owner_user_id) { status = 400; body = { error: "standalone agents cannot submit payments yet" }; }
      else {
        const b = await req.json().catch(() => ({}));
        const adId = String(b?.ad_id ?? "");
        const txHash = String(b?.tx_hash ?? "");
        const chainId = Number(b?.chain_id);
        if (!adId || !/^0x[0-9a-f]{64}$/i.test(txHash) || !Number.isFinite(chainId)) {
          status = 400; body = { error: "ad_id, tx_hash and chain_id required" };
        } else {
          const { data: ad } = await svc.from("ads").select("id, seller_id, price_usdc").eq("id", adId).maybeSingle();
          if (!ad) { status = 404; body = { error: "ad_not_found" }; }
          else {
            let expected = Number(ad.price_usdc);
            const { data: accepted } = await svc.from("offers")
              .select("amount_usdc").eq("ad_id", adId).eq("buyer_id", agent.owner_user_id).eq("status", "accepted").maybeSingle();
            if (accepted) expected = Number(accepted.amount_usdc);
            const { data: sellerProf } = await svc.from("profiles").select("wallet_address").eq("id", ad.seller_id).maybeSingle();
            if (!sellerProf?.wallet_address) { status = 400; body = { error: "seller has no wallet on file" }; }
            else {
              const check = await verifyUsdcTransfer({
                chainId, txHash,
                expectedTo: sellerProf.wallet_address,
                expectedAmountUsdc: expected,
                expectedFrom: agent.wallet_address,
              });
              if (!check.ok) { status = 400; body = { error: `payment verification failed: ${check.error}` }; }
              else {
                const { data, error } = await svc.from("payments").insert({
                  ad_id: adId, seller_id: ad.seller_id, buyer_id: agent.owner_user_id,
                  amount_usdc: expected, tx_hash: txHash, chain_id: chainId,
                }).select("*").single();
                if (error) {
                  status = error.code === "23505" ? 409 : 400;
                  body = { error: error.code === "23505" ? "tx_hash already recorded" : error.message };
                } else {
                  await svc.from("agents").update({ reputation_score: agent.reputation_score + 1 }).eq("id", agent.id);
                  await svc.from("ads").update({ status: "sold", sold_at: new Date().toISOString() }).eq("id", adId);
                  body = data;
                }
              }
            }
          }
        }
      }
    }

    // /messages GET
    else if (route === "/messages" && method === "GET") {
      if (!agent.owner_user_id) { status = 400; body = { error: "standalone agents cannot read messages yet" }; }
      else {
        const { data, error } = await svc.from("messages")
          .select("*").or(`sender_id.eq.${agent.owner_user_id},recipient_id.eq.${agent.owner_user_id}`)
          .order("created_at", { ascending: false }).limit(200);
        if (error) { status = 400; body = { error: error.message }; }
        else body = { messages: data };
      }
    }

    // /messages POST
    else if (route === "/messages" && method === "POST") {
      if (!agent.owner_user_id) { status = 400; body = { error: "standalone agents cannot send messages yet" }; }
      else {
        const b = await req.json().catch(() => ({}));
        const row = {
          sender_id: agent.owner_user_id,
          recipient_id: String(b?.recipient_id ?? ""),
          ad_id: String(b?.ad_id ?? ""),
          content: String(b?.content ?? "").slice(0, 4000),
        };
        if (!row.recipient_id || !row.ad_id || !row.content) {
          status = 400; body = { error: "ad_id, recipient_id, content required" };
        } else {
          const { data, error } = await svc.from("messages").insert(row).select("*").single();
          if (error) { status = 400; body = { error: error.message }; }
          else body = data;
        }
      }
    }

    else { status = 404; }
  } catch (e) {
    status = 500;
    body = { error: (e as Error).message };
  }

  await logActivity(svc, agent.id, route, method, status);
  return json(body, status);
});
