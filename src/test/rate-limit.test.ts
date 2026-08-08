import { describe, it, expect } from "vitest";
import { checkUserRateLimit } from "../dev-server/supabase/functions/_shared/user-rate-limit.ts";

function stubAdmin(count: number, fail = false) {
  const inserted: any[] = [];
  return {
    inserted,
    from() {
      return {
        select: () => ({ eq: () => ({ gte: () => (fail ? { error: new Error("db down") } : { count, error: null }) }) }),
        insert: (row: any) => { inserted.push(row); return { error: null }; },
      };
    },
  };
}

describe("per-user rate limit", () => {
  it("allows a call under the limit and records it", async () => {
    const a = stubAdmin(5);
    const r = await checkUserRateLimit(a, "u1", "escrow-confirm-funded");
    expect(r.ok).toBe(true);
    expect(r.limit).toBe(20);
    expect(a.inserted.length).toBe(1);
  });
  it("blocks at the limit without recording", async () => {
    const a = stubAdmin(20);
    const r = await checkUserRateLimit(a, "u1", "escrow-confirm-funded");
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBe(60);
    expect(a.inserted.length).toBe(0);
  });
  it("uses a tighter ceiling for withdrawals", async () => {
    const r = await checkUserRateLimit(stubAdmin(5), "0xabc", "treasury-withdraw");
    expect(r.ok).toBe(false);
    expect(r.limit).toBe(5);
  });
  it("fails open when the limiter itself is broken", async () => {
    const r = await checkUserRateLimit(stubAdmin(0, true), "u1", "escrow-create");
    expect(r.ok).toBe(true);
  });
});
