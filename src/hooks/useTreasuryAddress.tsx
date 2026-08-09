import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TreasuryPurpose = "escrow" | "revenue";

export interface TreasuryInfo {
  address: `0x${string}`;
  chainId: number;
  purpose: TreasuryPurpose;
  listingFeeUsdc: number;
  saleFeeBps: number;
}

/**
 * Resolves the platform treasury address for a purpose/chain from the backend.
 *
 * There is intentionally no fallback address: when the treasury has not been
 * provisioned the hook returns an error and payment UI must stay disabled,
 * rather than risk sending real USDC somewhere unrecoverable.
 */
export function useTreasuryAddress(
  purpose: TreasuryPurpose,
  chainId?: number,
  enabled = true,
) {
  const [data, setData] = useState<TreasuryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    let cancelled = false;

    // The backend requires a session, so skip the lookup entirely when the
    // caller is not ready (e.g. an anonymous visitor browsing a listing).
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      const { data: res, error: fnError } = await supabase.functions.invoke("treasury-address", {
        body: { purpose, chain_id: chainId },
      });

      if (cancelled) return;

      if (fnError || !res?.address) {
        setData(null);
        setError(
          res?.error ??
            fnError?.message ??
            "Payments are not available yet — the platform treasury is not configured.",
        );
      } else {
        setData({
          address: res.address as `0x${string}`,
          chainId: res.chain_id,
          purpose: res.purpose,
          listingFeeUsdc: res.fees?.listing_fee_usdc ?? 0,
          saleFeeBps: res.fees?.sale_fee_bps ?? 0,
        });
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [purpose, chainId, enabled]);

  return { treasury: data, error, loading };
}
