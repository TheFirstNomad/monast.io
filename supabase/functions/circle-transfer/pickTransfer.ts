// Matching a Circle transfer to one of our payments. Kept in its own module so
// it can be unit-tested without booting the function's runtime dependencies.
import { formatUsdc, toBaseUnits } from "../_shared/fees.ts";

export interface CircleTx {
  id?: string;
  state?: string;
  txHash?: string | null;
  amounts?: string[];
  destinationAddress?: string;
  errorReason?: string | null;
  errorDetails?: string | null;
  createDate?: string | null;
}

export interface PickOptions {
  /** On-chain hashes already credited to another payment; never reuse them. */
  excludeTxHashes?: Iterable<string>;
  /** Ignore transfers created before this moment (e.g. before the listing existed). */
  notBefore?: string | null;
}

/**
 * Finds the outbound transfer for a given payment by matching destination and
 * amount. Prefers a completed transfer, then one still in flight, so a caller
 * can either settle immediately or keep polling.
 */
export function pickTransfer(
  txs: CircleTx[],
  destinationAddress: string,
  amountUsdc: number,
  opts: PickOptions = {},
): CircleTx | null {
  const used = new Set([...(opts.excludeTxHashes ?? [])].map((h) => h.toLowerCase()));
  const notBefore = opts.notBefore ? Date.parse(opts.notBefore) : NaN;
  const wanted = toBaseUnits(formatUsdc(toBaseUnits(amountUsdc)));
  const dest = destinationAddress.toLowerCase();
  const matches = txs.filter((t) => {
    const amount = t.amounts?.[0];
    if (!amount) return false;
    let same = false;
    try {
      same = toBaseUnits(amount) === wanted;
    } catch {
      same = false;
    }
    if (!same || (t.destinationAddress ?? "").toLowerCase() !== dest) return false;
    if (t.txHash && used.has(t.txHash.toLowerCase())) return false;
    if (!Number.isNaN(notBefore) && t.createDate) {
      const created = Date.parse(t.createDate);
      // Small allowance for clock skew between Circle and our database.
      if (!Number.isNaN(created) && created < notBefore - 60_000) return false;
    }
    return true;
  });
  const rank = (t: CircleTx) => {
    const s = String(t.state ?? "").toUpperCase();
    if (t.txHash && (s === "COMPLETE" || s === "CONFIRMED")) return 0;
    if (["FAILED", "CANCELLED", "DENIED", "EXPIRED"].includes(s)) return 2;
    return 1;
  };
  matches.sort((a, b) => rank(a) - rank(b));
  return matches[0] ?? null;
}
