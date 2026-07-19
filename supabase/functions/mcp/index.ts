// MCP (Model Context Protocol) server for monast.io.
// Streamable HTTP transport, JSON-RPC 2.0. Auth: Authorization: Bearer monast_sk_...
//
// Connect from Claude / Cursor / ChatGPT by pointing the MCP client at:
//   https://<project>.supabase.co/functions/v1/mcp
//
// Implements:
//   - initialize, tools/list, tools/call, ping
// Tools wrap the Agent API surface (see /agent-api).

import {
  authenticateAgent, checkRateLimit, corsHeaders, logActivity, svcClient, todaySpendUsdc,
} from "../_shared/agent-auth.ts";
import { verifyUsdcTransfer } from "../_shared/tx-verify.ts";

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcReq = { jsonrpc: "2.0"; id?: number | string | null; method: string; params?: any };
type JsonRpcRes = { jsonrpc: "2.0"; id: number | string | null; result?: any; error?: { code: number; message: string; data?: any } };

const TOOLS = [
  {
    name: "me",
    description: "Return the calling agent's profile, reputation, and remaining daily USDC quota.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_ads",
    description: "Search active marketplace listings.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Full-text query over title" },
        category: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_ad",
    description: "Fetch full details for a single ad, including seller reputation.",
    inputSchema: { type: "object", properties: { ad_id: { type: "string" } }, required: ["ad_id"], additionalProperties: false },
  },
  {
    name: "list_offers",
    description: "List offers the calling agent is party to (as buyer or seller).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_offer",
    description: "Create a new offer on an ad. Subject to per-agent daily spend cap.",
    inputSchema: {
      type: "object",
      properties: { ad_id: { type: "string" }, amount_usdc: { type: "number", exclusiveMinimum: 0 } },
      required: ["ad_id", "amount_usdc"],
      additionalProperties: false,
    },
  },
  {
    name: "accept_offer",
    description: "Seller agent accepts a pending offer.",
    inputSchema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"], additionalProperties: false },
  },
  {
    name: "cancel_offer",
    description: "Buyer agent cancels its own pending offer.",
    inputSchema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"], additionalProperties: false },
  },
  {
    name: "submit_payment",
    description: "Record an on-chain USDC payment (Monad) as proof of settlement.",
    inputSchema: {
      type: "object",
      properties: {
        ad_id: { type: "string" }, seller_id: { type: "string" },
        amount_usdc: { type: "number", exclusiveMinimum: 0 },
        tx_hash: { type: "string" }, chain_id: { type: "integer" },
      },
      required: ["ad_id", "seller_id", "amount_usdc", "tx_hash", "chain_id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_messages",
    description: "List the calling agent's recent messages.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "send_message",
    description: "Send a message to another user about an ad.",
    inputSchema: {
      type: "object",
      properties: { ad_id: { type: "string" }, recipient_id: { type: "string" }, content: { type: "string", maxLength: 4000 } },
      required: ["ad_id", "recipient_id", "content"],
      additionalProperties: false,
    },
  },
];

function rpcOk(id: any, result: any): JsonRpcRes { return { jsonrpc: "2.0", id: id ?? null, result }; }
function rpcErr(id: any, code: number, message: string, data?: any): JsonRpcRes {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}
function jsonResponse(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function toolResult(data: unknown) {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function toolError(message: string) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function runTool(name: string, args: any, agent: any, svc: any) {
  switch (name) {
    case "me": {
      const spent = await todaySpendUsdc(svc, agent.wallet_address, agent.owner_user_id);
      return toolResult({
        id: agent.id, display_name: agent.display_name, kind: agent.kind,
        wallet_address: agent.wallet_address, reputation_score: agent.reputation_score,
        max_spend_usdc_per_day: Number(agent.max_spend_usdc_per_day),
        spent_today_usdc: spent,
        remaining_today_usdc: Math.max(0, Number(agent.max_spend_usdc_per_day) - spent),
      });
    }
    case "search_ads": {
      const limit = Math.min(Number(args?.limit ?? 25), 100);
      let qb = svc.from("ads")
        .select("id,title,description,category,condition,location,price_usdc,images,seller_id,created_at")
        .eq("status", "active").order("created_at", { ascending: false }).limit(limit);
      if (args?.q) qb = qb.ilike("title", `%${String(args.q)}%`);
      if (args?.category) qb = qb.eq("category", String(args.category));
      const { data, error } = await qb;
      if (error) return toolError(error.message);
      return toolResult({ ads: data });
    }
    case "get_ad": {
      const { data, error } = await svc.from("ads")
        .select("*, seller:profiles!ads_seller_id_fkey(display_name, wallet_address, rating, total_ads)")
        .eq("id", String(args?.ad_id)).maybeSingle();
      if (error) return toolError(error.message);
      if (!data) return toolError("not_found");
      return toolResult(data);
    }
    case "list_offers": {
      if (!agent.owner_user_id) return toolError("standalone agents have no offer history yet");
      const { data, error } = await svc.from("offers")
        .select("*, ad:ads!offers_ad_id_fkey(title, price_usdc, seller_id)")
        .or(`buyer_id.eq.${agent.owner_user_id},ad.seller_id.eq.${agent.owner_user_id}`)
        .order("created_at", { ascending: false }).limit(100);
      if (error) return toolError(error.message);
      return toolResult({ offers: data });
    }
    case "create_offer": {
      if (!agent.owner_user_id) return toolError("standalone agents cannot create offers yet");
      const amount = Number(args?.amount_usdc);
      const adId = String(args?.ad_id ?? "");
      if (!adId || !Number.isFinite(amount) || amount <= 0) return toolError("ad_id and positive amount_usdc required");
      const spent = await todaySpendUsdc(svc, agent.wallet_address, agent.owner_user_id);
      if (spent + amount > Number(agent.max_spend_usdc_per_day))
        return toolError(`spend_cap_exceeded: spent_today=${spent} cap=${agent.max_spend_usdc_per_day}`);
      const { data, error } = await svc.from("offers")
        .insert({ ad_id: adId, buyer_id: agent.owner_user_id, amount_usdc: amount }).select("*").single();
      if (error) return toolError(error.message);
      return toolResult(data);
    }
    case "accept_offer": {
      const { data, error } = await svc.from("offers")
        .update({ status: "accepted" }).eq("id", String(args?.offer_id)).select("*").single();
      if (error) return toolError(error.message);
      return toolResult(data);
    }
    case "cancel_offer": {
      if (!agent.owner_user_id) return toolError("standalone agents cannot cancel offers");
      const { data, error } = await svc.from("offers")
        .update({ status: "cancelled" })
        .eq("id", String(args?.offer_id)).eq("buyer_id", agent.owner_user_id).select("*").single();
      if (error) return toolError(error.message);
      return toolResult(data);
    }
    case "submit_payment": {
      if (!agent.owner_user_id) return toolError("standalone agents cannot submit payments yet");
      const row = {
        ad_id: String(args?.ad_id ?? ""),
        seller_id: String(args?.seller_id ?? ""),
        buyer_id: agent.owner_user_id,
        amount_usdc: Number(args?.amount_usdc),
        tx_hash: String(args?.tx_hash ?? ""),
        chain_id: Number(args?.chain_id),
      };
      if (!row.ad_id || !row.seller_id || !row.tx_hash || !Number.isFinite(row.amount_usdc) || !Number.isFinite(row.chain_id))
        return toolError("missing fields");
      const { data, error } = await svc.from("payments").insert(row).select("*").single();
      if (error) return toolError(error.message);
      await svc.from("agents").update({ reputation_score: agent.reputation_score + 1 }).eq("id", agent.id);
      return toolResult(data);
    }
    case "list_messages": {
      if (!agent.owner_user_id) return toolError("standalone agents cannot read messages yet");
      const { data, error } = await svc.from("messages").select("*")
        .or(`sender_id.eq.${agent.owner_user_id},recipient_id.eq.${agent.owner_user_id}`)
        .order("created_at", { ascending: false }).limit(200);
      if (error) return toolError(error.message);
      return toolResult({ messages: data });
    }
    case "send_message": {
      if (!agent.owner_user_id) return toolError("standalone agents cannot send messages yet");
      const row = {
        sender_id: agent.owner_user_id,
        recipient_id: String(args?.recipient_id ?? ""),
        ad_id: String(args?.ad_id ?? ""),
        content: String(args?.content ?? "").slice(0, 4000),
      };
      if (!row.recipient_id || !row.ad_id || !row.content) return toolError("ad_id, recipient_id, content required");
      const { data, error } = await svc.from("messages").insert(row).select("*").single();
      if (error) return toolError(error.message);
      return toolResult(data);
    }
    default:
      return toolError(`unknown tool: ${name}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // GET advertises capabilities for clients that probe.
  if (req.method === "GET") {
    return jsonResponse({
      name: "monast.io",
      transport: "streamable-http",
      protocolVersion: PROTOCOL_VERSION,
      auth: "Authorization: Bearer monast_sk_...",
      endpoint: "POST JSON-RPC 2.0 to this URL",
    });
  }

  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const svc = svcClient();
  const agent = await authenticateAgent(req, svc);
  if (!agent) {
    return new Response(JSON.stringify(rpcErr(null, -32001, "invalid_api_key")), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json", "WWW-Authenticate": 'Bearer realm="monast-mcp"' },
    });
  }

  let payload: JsonRpcReq | JsonRpcReq[];
  try { payload = await req.json(); }
  catch { return jsonResponse(rpcErr(null, -32700, "Parse error"), 400); }

  const handle = async (msg: JsonRpcReq): Promise<JsonRpcRes | null> => {
    const { id, method, params } = msg;
    // Notifications (no id) -> no response.
    const isNotification = id === undefined || id === null;

    try {
      if (method === "initialize") {
        return rpcOk(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "monast.io", version: "1.0.0" },
          instructions: "Agent-native peer-to-peer marketplace settled in USDC on Monad. Use search_ads → get_ad → create_offer → submit_payment.",
        });
      }
      if (method === "notifications/initialized" || method === "initialized") {
        return isNotification ? null : rpcOk(id, {});
      }
      if (method === "ping") return rpcOk(id, {});
      if (method === "tools/list") return rpcOk(id, { tools: TOOLS });
      if (method === "tools/call") {
        const name = params?.name as string;
        const args = params?.arguments ?? {};
        const rl = await checkRateLimit(svc, agent.id, `mcp:${name}`, name === "search_ads" || name === "get_ad" || name.startsWith("list_") || name === "me" ? "GET" : "POST");
        if (!rl.ok) {
          await logActivity(svc, agent.id, `mcp:${name}`, "POST", 429, { used: rl.used, limit: rl.limit });
          return rpcOk(id, toolError(`rate_limited: used=${rl.used} limit=${rl.limit}/min`));
        }
        const result = await runTool(name, args, agent, svc);
        await logActivity(svc, agent.id, `mcp:${name}`, "POST", (result as any).isError ? 400 : 200);
        return rpcOk(id, result);
      }
      if (method === "resources/list") return rpcOk(id, { resources: [] });
      if (method === "prompts/list") return rpcOk(id, { prompts: [] });

      return rpcErr(id, -32601, `Method not found: ${method}`);
    } catch (e) {
      return rpcErr(id, -32603, (e as Error).message);
    }
  };

  if (Array.isArray(payload)) {
    const results = (await Promise.all(payload.map(handle))).filter(Boolean);
    return jsonResponse(results);
  }
  const res = await handle(payload);
  if (!res) return new Response(null, { status: 204, headers: corsHeaders });
  return jsonResponse(res);
});
