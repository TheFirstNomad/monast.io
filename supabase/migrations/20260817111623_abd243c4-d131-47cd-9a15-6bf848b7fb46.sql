DROP POLICY IF EXISTS "Sellers can update their own ads" ON public.ads;
CREATE POLICY "Sellers can update their own ads"
ON public.ads FOR UPDATE TO authenticated
USING (auth.uid() = seller_id)
WITH CHECK (
  auth.uid() = seller_id
  AND status IN ('pending_fee','active','reserved','sold','removed')
);

CREATE OR REPLACE FUNCTION public.prevent_seller_featured_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.featured IS DISTINCT FROM OLD.featured
       OR NEW.featured_until IS DISTINCT FROM OLD.featured_until THEN
      RAISE EXCEPTION 'Only administrators can change promotion fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;