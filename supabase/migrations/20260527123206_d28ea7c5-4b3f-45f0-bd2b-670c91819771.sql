
CREATE OR REPLACE FUNCTION public.guard_offer_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT seller_id INTO v_seller FROM public.ads WHERE id = NEW.ad_id;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = v_seller THEN
      IF OLD.status <> 'pending' OR NEW.status NOT IN ('accepted','rejected') THEN
        RAISE EXCEPTION 'Seller can only accept or reject pending offers';
      END IF;
    ELSIF auth.uid() = NEW.buyer_id THEN
      IF OLD.status <> 'pending' OR NEW.status <> 'cancelled' THEN
        RAISE EXCEPTION 'Buyer can only cancel their own pending offers';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not authorized to change offer status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_offer_status_changes ON public.offers;
CREATE TRIGGER trg_guard_offer_status_changes
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.guard_offer_status_changes();

DROP TRIGGER IF EXISTS trg_protect_offer_immutables ON public.offers;
CREATE TRIGGER trg_protect_offer_immutables
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.protect_offer_immutables();

DROP TRIGGER IF EXISTS trg_prevent_seller_featured_change ON public.ads;
CREATE TRIGGER trg_prevent_seller_featured_change
BEFORE UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_featured_change();

DROP TRIGGER IF EXISTS trg_bump_profile_total_ads ON public.ads;
CREATE TRIGGER trg_bump_profile_total_ads
AFTER INSERT OR DELETE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.bump_profile_total_ads();

DROP TRIGGER IF EXISTS trg_update_seller_rating ON public.reviews;
CREATE TRIGGER trg_update_seller_rating
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_seller_rating();
