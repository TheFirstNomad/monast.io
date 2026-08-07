// Owner-only helper: returns a fresh entity-secret ciphertext.
//
// Circle requires the entity secret to be registered ONCE in the Circle console
// ("Register entity secret" -> paste ciphertext) before any developer-controlled
// wallet call works. This endpoint produces that ciphertext from the secret
// stored in the backend so it can be pasted into the console.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { verifyAdmin } from "../_shared/admin-auth.ts";
import { entitySecretCiphertext } from "../_shared/circle-dev.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    if (!(await verifyAdmin(req, admin))) return json({ error: "Forbidden" }, 403);
    return json({ ciphertext: await entitySecretCiphertext() });
  } catch (e) {
    console.error("treasury-entity-ciphertext", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
