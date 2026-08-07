import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "arbitrator" | "moderator" | "user";

/**
 * Reads the signed-in user's roles from the database. Roles are stored in a
 * dedicated table that users can only read for themselves — this hook is for
 * showing or hiding UI, never the security boundary. Every privileged action is
 * re-checked server-side.
 */
export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (cancelled) return;
      setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const has = (...want: AppRole[]) => want.some((r) => roles.includes(r));
  return {
    roles,
    loading,
    has,
    isArbitrator: has("arbitrator", "admin"),
    isModerator: has("moderator", "arbitrator", "admin"),
  };
}
