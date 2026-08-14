// Fee model - server mirror of src/lib/fees.ts.
// Authoritative values also live in the fee_settings table; these constants are
// the fallback and the arithmetic used when moving money.

export const LISTING_FEE_USDC = 0.15;
export const SALE_FEE_BPS = 100; // 1%
export const DELIVERY_WINDOW_HOURS = 72;
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

/** Reads live fee settings, falling back to the constants above. */
export async function loadFeeSettings(admin: any): Promise<{
  listingFeeUsdc: number;
  saleFeeBps: number;
  deliveryWindowHours: number;
  cancelResponseHours: number;
}> {
  const fallback = {
    listingFeeUsdc: LISTING_FEE_USDC,
    saleFeeBps: SALE_FEE_BPS,
    deliveryWindowHours: DELIVERY_WINDOW_HOURS,
    cancelResponseHours: CANCEL_RESPONSE_HOURS,
  };
  try {
    const { data } = await admin.from("fee_settings").select("key, value");
    if (!data?.length) return fallback;
    const map = new Map<string, number>(data.map((r: any) => [r.key, Number(r.value)]));
    return {
      listingFeeUsdc: map.get("listing_fee_usdc") ?? fallback.listingFeeUsdc,
      saleFeeBps: map.get("sale_fee_bps") ?? fallback.saleFeeBps,
      deliveryWindowHours: map.get("delivery_window_hours") ?? fallback.deliveryWindowHours,
      cancelResponseHours: map.get("cancel_response_hours") ?? fallback.cancelResponseHours,
    };
  } catch {
    return fallback;
  }
}
