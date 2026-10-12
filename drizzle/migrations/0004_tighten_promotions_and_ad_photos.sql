DROP POLICY IF EXISTS "Anyone can view promotions" ON public.promotions;
CREATE POLICY "Owners can view their promotions" ON public.promotions
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
REVOKE SELECT ON public.promotions FROM anon;

DROP POLICY IF EXISTS "Ad photos are publicly readable" ON storage.objects;
CREATE POLICY "Owners can list their ad photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ad-photos' AND owner_id = (select auth.uid()::text));