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

    const allowedMethods = ["GET", "POST", "PUT", "PATCH"];
    const httpMethod = String(method).toUpperCase();
    if (!allowedMethods.includes(httpMethod)) {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never let the browser supply auth or a kit key — the server owns both.
    const safeHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(extraHeaders ?? {})) {
      const lower = k.toLowerCase();
      if (lower === "authorization" || lower === "apikey" || lower.includes("kit")) continue;
      if (typeof v === "string") safeHeaders[k] = v;
    }

    // Strip any kitKey the client tried to embed in the request body.
    let safeBody = body;
    if (safeBody && typeof safeBody === "object" && !Array.isArray(safeBody)) {
      const clone = { ...(safeBody as Record<string, unknown>) };
      delete clone.kitKey;
      if (clone.config && typeof clone.config === "object" && !Array.isArray(clone.config)) {
        const cfg = { ...(clone.config as Record<string, unknown>) };
        delete cfg.kitKey;
        clone.config = cfg;
      }
      safeBody = clone;
    }

    const targetUrl = `${CIRCLE_BASE}${path}`;
    const fetchInit: RequestInit = {
      method: httpMethod,
      headers: {
        ...safeHeaders,
        "Content-Type": "application/json",
        Authorization: `Bearer ${kitKey}`,
      },
    };
    if (httpMethod !== "GET" && safeBody !== undefined) {
      fetchInit.body = JSON.stringify(safeBody);
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
