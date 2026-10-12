-- Fee settings: only server code reads them
DROP POLICY IF EXISTS "Anyone can read fee settings" ON public.fee_settings;
REVOKE SELECT ON public.fee_settings FROM anon, authenticated;

-- Profiles: visible only when the person is active on the marketplace or connected to the viewer
CREATE OR REPLACE FUNCTION public.profile_is_visible(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.ads WHERE seller_id = _profile_id AND status NOT IN ('pending_fee','removed'))
    OR EXISTS (SELECT 1 FROM public.reviews WHERE buyer_id = _profile_id)
    OR (auth.uid() IS NOT NULL AND (
         EXISTS (SELECT 1 FROM public.messages WHERE (sender_id = _profile_id AND recipient_id = auth.uid()) OR (recipient_id = _profile_id AND sender_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM public.offers o JOIN public.ads a ON a.id = o.ad_id WHERE (o.buyer_id = _profile_id AND a.seller_id = auth.uid()) OR (o.buyer_id = auth.uid() AND a.seller_id = _profile_id))
      OR EXISTS (SELECT 1 FROM public.escrows WHERE (buyer_id = _profile_id AND seller_id = auth.uid()) OR (seller_id = _profile_id AND buyer_id = auth.uid()))
    ))
$$;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles visible when active or connected" ON public.profiles
  FOR SELECT USING (public.profile_is_visible(id));
-- Visitors who aren't signed in don't need wallet addresses
REVOKE SELECT (wallet_address) ON public.profiles FROM anon;

-- Reviews: hide reviews tied to removed or unpublished listings
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews visible on published listings" ON public.reviews
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.ads a WHERE a.id = reviews.ad_id AND a.status NOT IN ('pending_fee','removed')));