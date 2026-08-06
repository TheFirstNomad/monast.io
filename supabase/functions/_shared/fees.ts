// Fee model — server mirror of src/lib/fees.ts.
// Authoritative values also live in the fee_settings table; these constants are
// the fallback and the arithmetic used when moving money.

export const LISTING_FEE_USDC = 0.15;
export const SALE_FEE_BPS = 100; // 1%
export const DELIVERY_WINDOW_HOURS = 72;
export const CANCEL_RESPONSE_HOURS = 48;

const USDC_DP = 6;

function round6(n: number): number {
  return Math.round(n * 10 ** USDC_DP) / 10 ** USDC_DP;
}

export interface FeeSplit {
  gross: number;
  fee: number;
  sellerNet: number;
}

export function splitSale(amountUsdc: number, feeBps = SALE_FEE_BPS): FeeSplit {
  const gross = round6(amountUsdc);
  const fee = round6((gross * feeBps) / 10_000);
  return { gross, fee, sellerNet: round6(gross - fee) };
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
