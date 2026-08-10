CREATE OR REPLACE FUNCTION public.lock_ad_terms_during_escrow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.price_usdc IS DISTINCT FROM OLD.price_usdc THEN
    IF EXISTS (
      SELECT 1 FROM public.escrows
      WHERE ad_id = OLD.id AND status IN ('created','funded','disputed')
    ) THEN
      RAISE EXCEPTION 'Item name and price are locked while an active escrow exists on this listing';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_ad_terms_during_escrow ON public.ads;
CREATE TRIGGER trg_lock_ad_terms_during_escrow
BEFORE UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.lock_ad_terms_during_escrow();