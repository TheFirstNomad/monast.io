// Standalone reconciliation endpoint. Same cron token as escrow-maintenance,
// so it can be triggered on its own schedule or manually for verification  - 
// never callable from the browser.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { reconcilePayouts } from "../_shared/reconcile.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const token = req.headers.get("x-cron-token") ?? "";
    const { data: cfg } = await admin
      .from("internal_config")
      .select("value")
      .eq("key", "cron_token")
      .maybeSingle();
    if (!cfg?.value || !(await timingSafeEqual(token, cfg.value))) {
      return json({ error: "Forbidden" }, 403);
    }

    const report = await reconcilePayouts(admin);
    return json({ ...report, ran_at: new Date().toISOString() });
  } catch (e) {
    console.error("payout-reconcile", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
