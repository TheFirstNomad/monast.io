// Owner-only role management — how arbitrators and moderators get appointed.
//
// Authorised by a fresh owner-wallet signature (the same scheme as the treasury
// console), because roles are the root of trust for the dispute queue and must
// not depend on a role that does not exist yet.
//
// POST { action: "list" }
// POST { action: "grant" | "revoke", email?, user_id?, role }

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { verifyAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROLES = ["admin", "arbitrator", "moderator", "user"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    if (!(await verifyAdmin(req, admin))) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    if (action === "list") {
      const { data: rows } = await admin
        .from("user_roles")
        .select("id, user_id, role, granted_at")
        .order("granted_at", { ascending: false });

      const enriched = [];
      for (const r of rows ?? []) {
        const { data: u } = await admin.auth.admin.getUserById(r.user_id);
        enriched.push({ ...r, email: u?.user?.email ?? null });
      }
      return json({ roles: enriched });
    }

    if (action !== "grant" && action !== "revoke") return json({ error: "Unknown action" }, 400);

    const role = String(body.role ?? "");
    if (!ROLES.includes(role)) return json({ error: `role must be one of ${ROLES.join(", ")}` }, 400);

    let userId = body.user_id ? String(body.user_id) : "";
    const email = body.email ? String(body.email).trim().toLowerCase() : "";

    if (!userId && email) {
      // Look the account up by email across the auth user list.
      let page = 1;
      while (page <= 20 && !userId) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const match = data?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email);
        if (match) userId = match.id;
        if (!data?.users?.length || data.users.length < 200) break;
        page += 1;
      }
    }
    if (!userId) return json({ error: "No account found for that email" }, 404);

    if (action === "grant") {
      const { error } = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (error) throw error;
      return json({ ok: true, user_id: userId, role, granted: true });
    }

    const { error } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) throw error;
    return json({ ok: true, user_id: userId, role, granted: false });
  } catch (e) {
    console.error("admin-roles", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
