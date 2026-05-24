// SSRF allowlist helper — use before any server-side fetch of a user-supplied URL.
// Blocks private/loopback/link-local addresses and restricts to https.

const PRIVATE_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const ALLOWED_PROTOCOLS = new Set(["https:"]);

export interface SsrfCheck {
  ok: boolean;
  reason?: string;
  url?: URL;
}

export function checkSsrf(rawUrl: string, opts?: { allowHttp?: boolean; hostAllowlist?: string[] }): SsrfCheck {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return { ok: false, reason: "invalid_url" }; }

  const protos = opts?.allowHttp ? new Set([...ALLOWED_PROTOCOLS, "http:"]) : ALLOWED_PROTOCOLS;
  if (!protos.has(url.protocol)) return { ok: false, reason: "protocol_blocked", url };

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return { ok: false, reason: "loopback", url };
  if (PRIVATE_RANGES.some((re) => re.test(host))) return { ok: false, reason: "private_range", url };

  if (opts?.hostAllowlist && !opts.hostAllowlist.some((h) => host === h || host.endsWith(`.${h}`))) {
    return { ok: false, reason: "host_not_allowed", url };
  }
  return { ok: true, url };
}

/** Resolve + fetch with SSRF guard and timeout. */
export async function safeFetch(rawUrl: string, init?: RequestInit & { timeoutMs?: number; hostAllowlist?: string[] }) {
  const check = checkSsrf(rawUrl, { hostAllowlist: init?.hostAllowlist });
  if (!check.ok || !check.url) throw new Error(`ssrf_blocked:${check.reason}`);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), init?.timeoutMs ?? 10_000);
  try {
    return await fetch(check.url.toString(), { ...init, signal: ac.signal, redirect: "manual" });
  } finally {
    clearTimeout(t);
  }
}
