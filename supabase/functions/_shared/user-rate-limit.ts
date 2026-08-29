// Per-user rate limiting for money-adjacent endpoints.
//
// Mirrors checkRateLimit in agent-auth.ts (same agent_rate_limits table, a
// different bucket namespace) so there is one place that counts calls. Human
// endpoints previously had no ceiling at all: a client retry loop on
// escrow-confirm-funded meant unbounded live RPC calls to the Arc node.

export interface RateLimitResult {
  ok: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
}

const WINDOW_MS = 60_000;

/** Per-minute ceilings. Generous enough that real usage never notices. */
export const USER_LIMITS: Record<string, number> = {
  "escrow-confirm-funded": 20,
  "escrow-create": 20,
  "escrow-release": 10,
  "escrow-refund": 10,
  "escrow-dispute": 10,
  "escrow-cancel": 10,
  "treasury-withdraw": 5,
  "circle-escrow-fund": 20,
  "ad-listing-fee": 20,
  "record-payment": 20,
  "promote-checkout": 20,
  "circle-transfer": 20,
  // Read-only wallet calls (balance, activity, transfer status polling).
  "circle-transfer-read": 180,
  // Money leaving the platform: deliberately tight.
  "circle-withdraw": 5,

};
const DEFAULT_LIMIT = 20;

/**
 * Counts calls in a sliding one-minute window and records this one.
 * Fails open on an infrastructure error: a limiter outage must not take the
 * marketplace's payment paths down with it.
 */
export async function checkUserRateLimit(
  admin: any,
  userId: string,
  endpoint: string,
): Promise<RateLimitResult> {
  const limit = USER_LIMITS[endpoint] ?? DEFAULT_LIMIT;
  const bucket = `user:${userId}:${endpoint}`;
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  try {
    const { count, error } = await admin
      .from("agent_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("bucket_key", bucket)
      .gte("created_at", since);
    if (error) throw error;
    const used = count ?? 0;
    if (used >= limit) {
      console.warn("RATE_LIMITED", JSON.stringify({ userId, endpoint, used, limit }));
      return { ok: false, used, limit, retryAfterSeconds: 60 };
    }
    await admin.from("agent_rate_limits").insert({ bucket_key: bucket, endpoint });
    return { ok: true, used: used + 1, limit, retryAfterSeconds: 0 };
  } catch (e) {
    console.error("rate limiter unavailable", (e as Error).message);
    return { ok: true, used: 0, limit, retryAfterSeconds: 0 };
  }
}

/** Ready-made 429 body for a blocked call. */
export function rateLimitBody(r: RateLimitResult) {
  return {
    error: "Too many requests. Please wait a moment and try again.",
    limit: r.limit,
    window_seconds: 60,
    retry_after_seconds: r.retryAfterSeconds,
  };
}
