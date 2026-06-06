// Shared helpers for Agent API: API-key hashing, lookup, rate limit, activity log.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function svcClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateApiKey(): { key: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const key = `monast_sk_${body}`;
  return { key, prefix: key.slice(0, 12) };
}

export interface Agent {
  id: string;
  owner_user_id: string | null;
  kind: "delegated" | "standalone";
  display_name: string;
  wallet_address: string;
  status: string;
  max_spend_usdc_per_day: number;
  reputation_score: number;
}

export async function authenticateAgent(req: Request, supabase: SupabaseClient): Promise<Agent | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const key = auth.slice(7).trim();
  if (!key.startsWith("monast_sk_")) return null;
  const hash = await sha256Hex(key);
  const { data } = await supabase
    .from("agents")
    .select("id,owner_user_id,kind,display_name,wallet_address,status,max_spend_usdc_per_day,reputation_score")
    .eq("api_key_hash", hash)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return data as Agent;
}

const WRITE_LIMIT = 30;       // per minute
const READ_LIMIT = 600;       // per minute

export async function checkRateLimit(
  supabase: SupabaseClient,
  agentId: string,
  endpoint: string,
  method: string,
): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = method === "GET" ? READ_LIMIT : WRITE_LIMIT;
  const bucket = `agent:${agentId}:${method === "GET" ? "read" : "write"}`;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("agent_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", bucket)
    .gte("created_at", since);
  const used = count ?? 0;
  if (used >= limit) return { ok: false, used, limit };
  await supabase.from("agent_rate_limits").insert({ bucket_key: bucket, endpoint });
  return { ok: true, used: used + 1, limit };
}

export async function logActivity(
  supabase: SupabaseClient,
  agentId: string,
  endpoint: string,
  method: string,
  status: number,
  detail?: Record<string, unknown>,
) {
  await supabase.from("agent_activity").insert({
    agent_id: agentId, endpoint, method, status_code: status, detail: detail ?? null,
  });
}

export async function todaySpendUsdc(supabase: SupabaseClient, walletAddress: string, agentUserId: string | null): Promise<number> {
  // Sum today's payments where buyer is the agent's underlying user.
  if (!agentUserId) return 0;
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("payments")
    .select("amount_usdc")
    .eq("buyer_id", agentUserId)
    .gte("created_at", startOfDay.toISOString());
  return (data ?? []).reduce((s, r: any) => s + Number(r.amount_usdc || 0), 0);
}
