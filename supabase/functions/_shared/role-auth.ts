// Role-based authorisation for admin surfaces that are not owner-only.
//
// Roles live in public.user_roles and are read through the security-definer
// has_role function, so a client can never claim a role it was not granted.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

export type AppRole = "admin" | "arbitrator" | "moderator" | "user";

export interface RoleCheck {
  userId: string | null;
  roles: AppRole[];
  has: (...roles: AppRole[]) => boolean;
}

/** Resolves the caller and every role they hold. */
export async function authorize(req: Request, admin: any): Promise<RoleCheck> {
  const auth = req.headers.get("Authorization") ?? "";
  const empty: RoleCheck = { userId: null, roles: [], has: () => false };
  if (!auth.startsWith("Bearer ")) return empty;

  const asUser = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userRes } = await asUser.auth.getUser();
  const userId = userRes?.user?.id ?? null;
  if (!userId) return empty;

  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as AppRole);
  return { userId, roles, has: (...want: AppRole[]) => want.some((r) => roles.includes(r)) };
}
