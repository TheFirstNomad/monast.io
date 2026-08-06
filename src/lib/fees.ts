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

function round6(n: number): number {
  return Math.round(n * 10 ** USDC_DP) / 10 ** USDC_DP;
}

export interface FeeSplit {
  gross: number;
  fee: number;
  sellerNet: number;
}

/** Split a sale amount into the platform fee and the seller's net proceeds. */
export function splitSale(amountUsdc: number): FeeSplit {
  const gross = round6(amountUsdc);
  const fee = round6((gross * SALE_FEE_BPS) / 10_000);
  return { gross, fee, sellerNet: round6(gross - fee) };
}

export const SALE_FEE_LABEL = `${SALE_FEE_BPS / 100}%`;
export const LISTING_FEE_LABEL = `${LISTING_FEE_USDC} USDC`;
