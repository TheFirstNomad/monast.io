CREATE OR REPLACE FUNCTION public.guard_ads_listing_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.listing_fee_usdc := 0;
    NEW.listing_fee_tx_hash := NULL;
    NEW.listing_fee_paid_at := NULL;
    NEW.listing_fee_chain_id := NULL;
    -- Sellers can never self-promote or bypass the fee gate at creation time.
    NEW.featured := false;
    NEW.featured_until := NULL;
    NEW.status := 'pending_fee';
    NEW.sold_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.listing_fee_usdc IS DISTINCT FROM OLD.listing_fee_usdc
     OR NEW.listing_fee_tx_hash IS DISTINCT FROM OLD.listing_fee_tx_hash
     OR NEW.listing_fee_paid_at IS DISTINCT FROM OLD.listing_fee_paid_at
     OR NEW.listing_fee_chain_id IS DISTINCT FROM OLD.listing_fee_chain_id THEN
    RAISE EXCEPTION 'listing fee fields are set by the payment verifier only';
  END IF;
  RETURN NEW;
END;
$function$;