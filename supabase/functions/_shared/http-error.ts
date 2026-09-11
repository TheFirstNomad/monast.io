// Maps a thrown error to a meaningful HTTP status so a rejected upstream
// request, a configuration gap and a genuine crash are distinguishable to the
// caller and in the logs, instead of all collapsing into a bare 500.

export interface UpstreamError extends Error {
  /** Status returned by the upstream provider (Circle, RPC, ...). */
  upstreamStatus?: number;
}

/** Attach an upstream status to an error so the outer catch can relay it. */
export function withUpstreamStatus(message: string, status: number): UpstreamError {
  const err = new Error(message) as UpstreamError;
  err.upstreamStatus = status;
  return err;
}

export function statusFromError(e: unknown): number {
  if (!(e instanceof Error)) return 500;

  const upstream = (e as UpstreamError).upstreamStatus;
  if (typeof upstream === "number" && upstream >= 400 && upstream <= 599) {
    // Never relay another service's 401/403 as our own auth verdict.
    if (upstream === 401 || upstream === 403) return 502;
    return upstream < 500 ? upstream : 502;
  }

  // Treasury not provisioned yet: the service is unavailable, not broken.
  if (e.name === "TreasuryNotConfigured") return 503;

  const m = e.message || "";

  // "Circle /v1/... 422: {...}" style messages from older call sites.
  const circle = m.match(/\b(4\d{2}|5\d{2})\b\s*:/);
  if (circle) {
    const code = Number(circle[1]);
    if (code === 401 || code === 403) return 502;
    return code < 500 ? code : 502;
  }

  if (/spend_cap_exceeded|insufficient (balance|funds)/i.test(m)) return 402;
  if (/not authori[sz]ed|forbidden|only the /i.test(m)) return 403;
  if (/not found|no such|unknown escrow|ad_not_found/i.test(m)) return 404;
  if (/already (recorded|exists|funded|released)|duplicate key|conflict|invalid .*transition/i.test(m)) return 409;
  if (/is not configured|must be a 32-byte|did not return an entity public key/i.test(m)) return 503;
  if (/required|invalid|must (be|match)|malformed/i.test(m)) return 400;

  return 500;
}
