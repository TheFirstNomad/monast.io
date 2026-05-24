/**
 * circle-proxy — forwards requests to https://api.circle.com on behalf of
 * the browser, bypassing CORS. Requires a Supabase JWT and locks path to
 * /v1/stablecoinKits/*.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CIRCLE_BASE = "https://api.circle.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.slice("Bearer ".length);
    const { data, error } = await sb.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const kitKey = Deno.env.get("ARC_KIT_KEY");
    if (!kitKey) {
      return new Response(JSON.stringify({ error: "ARC_KIT_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { method = "POST", path, body, headers: extraHeaders } = payload as {
      method?: string; path: string; body?: unknown; headers?: Record<string, string>;
    };

    if (!path || typeof path !== "string" || !path.startsWith("/v1/stablecoinKits/")) {
      return new Response(JSON.stringify({ error: "Only /v1/stablecoinKits/* endpoints are allowed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = `${CIRCLE_BASE}${path}`;
    const fetchInit: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${kitKey}`,
        ...(extraHeaders ?? {}),
      },
    };
    if (method.toUpperCase() !== "GET" && body !== undefined) {
      fetchInit.body = JSON.stringify(body);
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);
    fetchInit.signal = ac.signal;

    const upstream = await fetch(targetUrl, fetchInit);
    clearTimeout(timer);
    const responseBody = await upstream.text();

    return new Response(responseBody, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[circle-proxy] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
