
CREATE OR REPLACE FUNCTION public.protect_review_immutables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.seller_id  IS DISTINCT FROM OLD.seller_id  THEN RAISE EXCEPTION 'seller_id is immutable on reviews'; END IF;
    IF NEW.ad_id      IS DISTINCT FROM OLD.ad_id      THEN RAISE EXCEPTION 'ad_id is immutable on reviews'; END IF;
    IF NEW.buyer_id   IS DISTINCT FROM OLD.buyer_id   THEN RAISE EXCEPTION 'buyer_id is immutable on reviews'; END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_review_immutables() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_review_immutables ON public.reviews;
CREATE TRIGGER trg_protect_review_immutables
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.protect_review_immutables();
