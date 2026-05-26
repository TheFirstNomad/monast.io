CREATE OR REPLACE FUNCTION public.bump_profile_total_ads()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.profiles
       SET total_ads = COALESCE(total_ads, 0) + 1
     WHERE id = NEW.seller_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.profiles
       SET total_ads = GREATEST(COALESCE(total_ads, 0) - 1, 0)
     WHERE id = OLD.seller_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ads_bump_total_ads_ins ON public.ads;
DROP TRIGGER IF EXISTS trg_ads_bump_total_ads_del ON public.ads;

CREATE TRIGGER trg_ads_bump_total_ads_ins
AFTER INSERT ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.bump_profile_total_ads();

CREATE TRIGGER trg_ads_bump_total_ads_del
AFTER DELETE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.bump_profile_total_ads();

-- Backfill existing counts
UPDATE public.profiles p
   SET total_ads = sub.cnt
  FROM (SELECT seller_id, COUNT(*)::int AS cnt FROM public.ads GROUP BY seller_id) sub
 WHERE p.id = sub.seller_id;