ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS removed_by_moderator boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_moderator_ad_edit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.seller_id THEN
    IF NEW.status <> 'removed' THEN
      RAISE EXCEPTION 'Moderators may only remove a listing';
    END IF;
    NEW.title := OLD.title; NEW.description := OLD.description; NEW.price_usdc := OLD.price_usdc;
    NEW.category := OLD.category; NEW.condition := OLD.condition; NEW.location := OLD.location;
    NEW.images := OLD.images; NEW.seller_id := OLD.seller_id; NEW.featured := OLD.featured;
    NEW.removed_by_moderator := true;
  ELSIF auth.uid() IS NOT NULL THEN
    NEW.removed_by_moderator := OLD.removed_by_moderator;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_listing_fee_tamper()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NEW.listing_fee_paid_at IS DISTINCT FROM OLD.listing_fee_paid_at
     OR NEW.listing_fee_tx_hash IS DISTINCT FROM OLD.listing_fee_tx_hash
     OR NEW.listing_fee_usdc IS DISTINCT FROM OLD.listing_fee_usdc
     OR NEW.listing_fee_chain_id IS DISTINCT FROM OLD.listing_fee_chain_id THEN
    RAISE EXCEPTION 'Listing fee fields are set by the payment verifier only';
  END IF;

  -- Unpaid listings may only be cancelled (removed), never made live.
  IF OLD.status = 'pending_fee' AND NEW.status NOT IN ('pending_fee','removed') THEN
    RAISE EXCEPTION 'An ad goes live only after its listing fee is verified';
  END IF;

  -- Relisting a removed ad: paid ads go back live free, unpaid go back to pending_fee.
  IF OLD.status = 'removed' AND NEW.status <> 'removed' THEN
    IF OLD.removed_by_moderator THEN
      RAISE EXCEPTION 'This listing was taken down by a moderator and cannot be relisted';
    END IF;
    IF NEW.status = 'active' AND OLD.listing_fee_paid_at IS NULL THEN
      RAISE EXCEPTION 'An ad goes live only after its listing fee is verified';
    END IF;
    IF NEW.status NOT IN ('active','pending_fee') THEN
      RAISE EXCEPTION 'A removed listing can only be relisted';
    END IF;
  END IF;

  IF NEW.status IN ('reserved') AND OLD.status <> 'reserved' THEN
    RAISE EXCEPTION 'Reserved status is set by the escrow flow only';
  END IF;
  RETURN NEW;
END;
$function$;