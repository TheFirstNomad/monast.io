-- 1. Prevent sellers from flipping `featured` on their own ads via a trigger
CREATE OR REPLACE FUNCTION public.prevent_seller_featured_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only block when the change originates from an authenticated end user.
  -- Service role / triggers running as superuser have auth.uid() = NULL and are allowed.
  IF auth.uid() IS NOT NULL AND NEW.featured IS DISTINCT FROM OLD.featured THEN
    RAISE EXCEPTION 'Only administrators can change the featured flag';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_seller_featured_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ads_prevent_featured_change ON public.ads;
CREATE TRIGGER trg_ads_prevent_featured_change
BEFORE UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_featured_change();

-- 2. Lock down offer updates: amount, ad, and buyer can't change; status transitions stay free.
CREATE OR REPLACE FUNCTION public.protect_offer_immutables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.ad_id      IS DISTINCT FROM OLD.ad_id      THEN RAISE EXCEPTION 'ad_id is immutable on offers'; END IF;
    IF NEW.buyer_id   IS DISTINCT FROM OLD.buyer_id   THEN RAISE EXCEPTION 'buyer_id is immutable on offers'; END IF;
    IF NEW.amount_usdc IS DISTINCT FROM OLD.amount_usdc THEN RAISE EXCEPTION 'amount_usdc cannot be changed after submission'; END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_offer_immutables() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_offers_protect_immutables ON public.offers;
CREATE TRIGGER trg_offers_protect_immutables
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.protect_offer_immutables();

-- Also add WITH CHECK to the existing UPDATE policy so PostgREST surfaces a clean RLS error if someone tries
-- to swap buyer_id / ad_id at the policy level too.
DROP POLICY IF EXISTS "Buyer or seller can update offer" ON public.offers;
CREATE POLICY "Buyer or seller can update offer"
ON public.offers
FOR UPDATE
TO authenticated
USING (
  auth.uid() = buyer_id
  OR auth.uid() IN (SELECT ads.seller_id FROM public.ads WHERE ads.id = offers.ad_id)
)
WITH CHECK (
  auth.uid() = buyer_id
  OR auth.uid() IN (SELECT ads.seller_id FROM public.ads WHERE ads.id = offers.ad_id)
);

-- 3. Payments INSERT must verify seller_id matches the ad's true seller.
DROP POLICY IF EXISTS "Buyers can insert their payments" ON public.payments;
CREATE POLICY "Buyers can insert their payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = buyer_id
  AND EXISTS (
    SELECT 1 FROM public.ads a
     WHERE a.id = payments.ad_id
       AND a.seller_id = payments.seller_id
  )
);