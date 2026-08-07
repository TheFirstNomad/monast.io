CREATE POLICY "Moderators can take listings down"
  ON public.ads FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'moderator')
    OR public.has_role(auth.uid(), 'arbitrator')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'moderator')
      OR public.has_role(auth.uid(), 'arbitrator')
      OR public.has_role(auth.uid(), 'admin')
    )
    AND status = 'removed'
  );

CREATE OR REPLACE FUNCTION public.guard_moderator_ad_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A moderator acting on someone else's ad may only change the status to
  -- 'removed'; every other column must stay untouched.
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.seller_id THEN
    IF NEW.status <> 'removed' THEN
      RAISE EXCEPTION 'Moderators may only remove a listing';
    END IF;
    NEW.title       := OLD.title;
    NEW.description := OLD.description;
    NEW.price_usdc  := OLD.price_usdc;
    NEW.category    := OLD.category;
    NEW.condition   := OLD.condition;
    NEW.location    := OLD.location;
    NEW.images      := OLD.images;
    NEW.seller_id   := OLD.seller_id;
    NEW.featured    := OLD.featured;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_moderator_ad_edit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_moderator_ad_edit
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.guard_moderator_ad_edit();