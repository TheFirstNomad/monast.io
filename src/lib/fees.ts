/**
 * Fee model — single source of truth for the client.
 * Mirrored server-side in supabase/functions/_shared/fees.ts and stored in the
 * fee_settings table. Keep all three in step.
 */

/** Flat anti-spam fee charged once per published ad. */
export const LISTING_FEE_USDC = 0.15;

/** Platform fee on a successful sale, in basis points. 100 bps = 1%. */
export const SALE_FEE_BPS = 100;

/** Hours after the seller marks delivery before a funded escrow auto-releases. */
export const DELIVERY_WINDOW_HOURS = 72;

/** Hours the seller has to answer a buyer's cancellation request. */
export const CANCEL_RESPONSE_HOURS = 48;

const USDC_DP = 6;
const SCALE = 1_000_000n;

/**
 * Currency math runs in integer micro-USDC (BigInt), never floating point.
 * Decimal floats accumulate the classic 0.1 + 0.2 error class, which is not
 * acceptable for money; decimals only exist at the display / API boundary.
 */
export function toBaseUnits(amount: number | string): bigint {
  const s = typeof amount === "number" ? amount.toFixed(USDC_DP) : String(amount).trim();
  if (!/^-?\d*(\.\d*)?$/.test(s) || s === "" || s === "." || s === "-") {
    throw new Error(`invalid USDC amount: ${amount}`);
  }
  const neg = s.startsWith("-");
  const [whole, frac = ""] = (neg ? s.slice(1) : s).split(".");
  const micros = BigInt(whole || "0") * SCALE + BigInt((frac + "000000").slice(0, USDC_DP));
  return neg ? -micros : micros;
}

/** Base units -> a plain number, safe for display and for JSON columns. */
export function fromBaseUnits(micros: bigint): number {
  return Number(micros) / Number(SCALE);
}

/** Base units -> the exact decimal string sent to Circle. */
export function formatUsdc(micros: bigint): string {
  const neg = micros < 0n;
  const v = neg ? -micros : micros;
  const frac = (v % SCALE).toString().padStart(USDC_DP, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${v / SCALE}${frac ? "." + frac : ""}`;
}

export interface FeeSplit {
  gross: number;
  fee: number;
  sellerNet: number;
  /** Exact integer micro-USDC, for anything that moves money. */
  grossMicros: bigint;
  feeMicros: bigint;
  sellerNetMicros: bigint;
}

/** Split a sale amount into the platform fee and the seller's net proceeds. */
export function splitSale(amountUsdc: number | string, feeBps = SALE_FEE_BPS): FeeSplit {
  const grossMicros = toBaseUnits(amountUsdc);
  // Integer division truncates, so the fee never rounds up against the seller.
  const feeMicros = (grossMicros * BigInt(feeBps)) / 10_000n;
  const sellerNetMicros = grossMicros - feeMicros;
  return {
    gross: fromBaseUnits(grossMicros),
    fee: fromBaseUnits(feeMicros),
    sellerNet: fromBaseUnits(sellerNetMicros),
    grossMicros,
    feeMicros,
    sellerNetMicros,
  };
}

export const SALE_FEE_LABEL = `${SALE_FEE_BPS / 100}%`;
export const LISTING_FEE_LABEL = `${LISTING_FEE_USDC} USDC`;
