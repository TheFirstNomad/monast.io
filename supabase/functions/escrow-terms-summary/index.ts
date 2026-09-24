// Summarizes escrow terms supplied by a buyer or seller into plain-language
// obligations and possible ambiguities. Only participants of the escrow may call it.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, Output } from "npm:ai";
import { z } from "npm:zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const RUN = "X-Lovable-AIG-Run-ID";

const schema = z.object({
  overview: z.string(),
  buyer_obligations: z.array(z.string()),
  seller_obligations: z.array(z.string()),
  ambiguities: z.array(z.object({ issue: z.string(), suggestion: z.string() })),
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await asUser.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const escrowId = String(body.escrow_id ?? "");
    const terms = String(body.terms ?? "").trim();
    if (!escrowId) return json({ error: "escrow_id required" }, 400);
    if (terms.length < 20) return json({ error: "Please enter the terms (at least 20 characters)." }, 400);
    if (terms.length > 8000) return json({ error: "Terms are too long (max 8000 characters)." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: escrow } = await admin
      .from("escrows").select("id, buyer_id, seller_id, amount_usdc, ad_id").eq("id", escrowId).maybeSingle();
    if (!escrow) return json({ error: "Escrow not found" }, 404);
    if (u.user.id !== escrow.buyer_id && u.user.id !== escrow.seller_id) return json({ error: "Forbidden" }, 403);
    const { data: ad } = await admin.from("ads").select("title").eq("id", escrow.ad_id).maybeSingle();

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI is not configured" }, 500);

    let runId = req.headers.get(RUN) ?? undefined;
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: async (input, init) => {
        const h = new Headers(init?.headers);
        if (runId && !h.has(RUN)) h.set(RUN, runId);
        const r = await fetch(input, { ...init, headers: h });
        runId ??= r.headers.get(RUN) ?? undefined;
        return r;
      },
    });

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({ schema }),
      system:
        "You explain escrow agreements for a peer-to-peer marketplace settled in USDC. Use plain, everyday language. " +
        "List what the buyer and seller must each do, and flag vague, missing or conflicting points (deadlines, delivery proof, " +
        "refund conditions, what counts as 'as described'). Keep each item to one or two short sentences, at most 8 items per list. " +
        "Do not give legal advice and do not invent terms that are not in the text.",
      prompt: `Listing: ${ad?.title ?? "unknown"}\nEscrow amount: ${escrow.amount_usdc} USDC\n\nTerms:\n${terms}`,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
      },
    });
    const output = await result.output;
    return json({ summary: output });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    console.error("escrow-terms-summary", e);
    if (status === 429) return json({ error: "Too many requests, try again shortly." }, 429);
    if (status === 402) return json({ error: "AI credits are exhausted. Add credits in workspace settings." }, 402);
    return json({ error: "Could not summarize the terms right now." }, status && status >= 400 ? status : 500);
  }
});
