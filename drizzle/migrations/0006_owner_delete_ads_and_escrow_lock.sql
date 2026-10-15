ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS deleted_by_owner boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ad_has_open_escrow(_ad_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.escrows WHERE ad_id = _ad_id AND status IN ('created','funded','disputed'))
$$;
REVOKE EXECUTE ON FUNCTION public.ad_has_open_escrow(uuid) FROM PUBLIC, anon;

-- Server-side guard for any delete path (including the direct delete policy).
CREATE OR REPLACE FUNCTION public.guard_ad_delete()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.ad_has_open_escrow(OLD.id) THEN
    RAISE EXCEPTION 'This listing has an escrow in progress and cannot be deleted';
  END IF;
  -- End users never hard-delete a listing that has trade history; it is archived instead.
  IF auth.uid() IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.escrows WHERE ad_id = OLD.id)
    OR EXISTS (SELECT 1 FROM public.payments WHERE ad_id = OLD.id)
  ) THEN
    RAISE EXCEPTION 'This listing has trade history and can only be archived';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ad_delete ON public.ads;
CREATE TRIGGER trg_guard_ad_delete BEFORE DELETE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.guard_ad_delete();

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

  -- An owner-deleted (archived) listing is final.
  IF OLD.deleted_by_owner AND NEW.deleted_by_owner = false THEN
    RAISE EXCEPTION 'A deleted listing cannot be restored';
  END IF;
  IF OLD.deleted_by_owner AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A deleted listing cannot be relisted';
  END IF;

  -- The seller cannot pull a listing while a buyer's escrow is in progress.
  IF NEW.status = 'removed' AND OLD.status <> 'removed'
     AND auth.uid() = OLD.seller_id AND public.ad_has_open_escrow(OLD.id) THEN
    RAISE EXCEPTION 'This listing has an escrow in progress and cannot be removed';
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

-- Owner delete: hard delete when there is no trade history, otherwise archive.
CREATE OR REPLACE FUNCTION public.owner_delete_ad(_ad_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ad public.ads;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_ad FROM public.ads WHERE id = _ad_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_ad.seller_id <> auth.uid() THEN RAISE EXCEPTION 'You can only delete your own listings'; END IF;
  IF public.ad_has_open_escrow(_ad_id) THEN
    RAISE EXCEPTION 'This listing has an escrow in progress and cannot be deleted';
  END IF;

  IF EXISTS (SELECT 1 FROM public.escrows WHERE ad_id = _ad_id)
     OR EXISTS (SELECT 1 FROM public.payments WHERE ad_id = _ad_id) THEN
    UPDATE public.ads
       SET deleted_by_owner = true,
           status = CASE WHEN status = 'sold' THEN status ELSE 'removed' END
     WHERE id = _ad_id;
    RETURN 'archived';
  END IF;

  DELETE FROM public.ads WHERE id = _ad_id;
  RETURN 'deleted';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_delete_ad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_delete_ad(uuid) TO authenticated;