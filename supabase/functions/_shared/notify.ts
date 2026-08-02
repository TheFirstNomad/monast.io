// Server-side notification helper. Notifications are insert-only from edge
// functions (service role) so a client can never fabricate an alert.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

export interface NotifyInput {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  link?: string;
}

export async function notify(inputs: NotifyInput | NotifyInput[]) {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  if (list.length === 0) return;
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("notifications").insert(
      list.map((n) => ({
        user_id: n.userId,
        kind: n.kind,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
      })),
    );
  } catch (e) {
    // Never fail the primary action because a notification could not be stored.
    console.error("notify failed", e);
  }
}
