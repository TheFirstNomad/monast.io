-- Ads now have a pre-live "pending_fee" state and a "reserved" state while an
-- escrow is in flight, so a listing cannot be double-sold and cannot go live
-- before its anti-spam fee is confirmed on-chain.
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_status_check;
ALTER TABLE public.ads
  ADD CONSTRAINT ads_status_check
  CHECK (status = ANY (ARRAY['pending_fee','active','reserved','sold','removed']));

-- A given on-chain payment can pay for exactly one listing fee.
CREATE UNIQUE INDEX IF NOT EXISTS ads_listing_fee_tx_hash_key
  ON public.ads (lower(listing_fee_tx_hash))
  WHERE listing_fee_tx_hash IS NOT NULL;

-- Sellers must never be able to mark their own listing fee as paid, or flip an
-- ad out of pending_fee, from the client. Only the service role may do that.
CREATE OR REPLACE FUNCTION public.prevent_listing_fee_tamper()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / server-side calls have no auth.uid() and are trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.listing_fee_paid_at IS DISTINCT FROM OLD.listing_fee_paid_at
     OR NEW.listing_fee_tx_hash IS DISTINCT FROM OLD.listing_fee_tx_hash
     OR NEW.listing_fee_usdc IS DISTINCT FROM OLD.listing_fee_usdc
     OR NEW.listing_fee_chain_id IS DISTINCT FROM OLD.listing_fee_chain_id THEN
    RAISE EXCEPTION 'Listing fee fields are set by the payment verifier only';
  END IF;

  IF OLD.status = 'pending_fee' AND NEW.status <> 'pending_fee' THEN
    RAISE EXCEPTION 'An ad goes live only after its listing fee is verified';
  END IF;

  -- Sellers cannot hand-edit escrow-driven states.
  IF NEW.status IN ('reserved') AND OLD.status <> 'reserved' THEN
    RAISE EXCEPTION 'Reserved status is set by the escrow flow only';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_listing_fee_tamper() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_listing_fee_tamper ON public.ads;
CREATE TRIGGER trg_prevent_listing_fee_tamper
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.prevent_listing_fee_tamper();

-- Newly posted ads start unpaid.
ALTER TABLE public.ads ALTER COLUMN status SET DEFAULT 'pending_fee';