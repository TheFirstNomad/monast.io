
-- 1. Protect sensitive agent fields from owner UPDATE
CREATE OR REPLACE FUNCTION public.protect_agent_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.wallet_address IS DISTINCT FROM OLD.wallet_address THEN
      RAISE EXCEPTION 'wallet_address cannot be changed by owner';
    END IF;
    IF NEW.max_spend_usdc_per_day IS DISTINCT FROM OLD.max_spend_usdc_per_day THEN
      RAISE EXCEPTION 'max_spend_usdc_per_day cannot be changed directly; contact support';
    END IF;
    IF NEW.kind IS DISTINCT FROM OLD.kind THEN
      RAISE EXCEPTION 'kind is immutable';
    END IF;
    IF NEW.api_key_hash IS DISTINCT FROM OLD.api_key_hash
       OR NEW.api_key_prefix IS DISTINCT FROM OLD.api_key_prefix THEN
      RAISE EXCEPTION 'API key fields cannot be modified directly';
    END IF;
    IF NEW.reputation_score IS DISTINCT FROM OLD.reputation_score THEN
      RAISE EXCEPTION 'reputation_score is server-managed';
    END IF;
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'owner_user_id is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_agent_sensitive_fields ON public.agents;
CREATE TRIGGER trg_protect_agent_sensitive_fields
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.protect_agent_sensitive_fields();

-- 2. Validate payment amount matches ad price
CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT price_usdc INTO v_price FROM public.ads WHERE id = NEW.ad_id;
    IF v_price IS NULL THEN
      RAISE EXCEPTION 'Ad not found for payment';
    END IF;
    -- Allow exact ad price OR an accepted offer amount for that ad+buyer
    IF NEW.amount_usdc <> v_price AND NOT EXISTS (
      SELECT 1 FROM public.offers
      WHERE ad_id = NEW.ad_id
        AND buyer_id = NEW.buyer_id
        AND status = 'accepted'
        AND amount_usdc = NEW.amount_usdc
    ) THEN
      RAISE EXCEPTION 'Payment amount must match the ad price or an accepted offer amount';
    END IF;
    IF NEW.amount_usdc <= 0 THEN
      RAISE EXCEPTION 'Payment amount must be positive';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_amount ON public.payments;
CREATE TRIGGER trg_validate_payment_amount
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_amount();

-- 3. Tighten review mutation policies from `public` to `authenticated`
DROP POLICY IF EXISTS "Buyers can delete own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Buyers can update own reviews" ON public.reviews;

CREATE POLICY "Buyers can delete own reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers can update own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);
