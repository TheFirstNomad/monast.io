DROP POLICY IF EXISTS "Buyers can create reviews" ON public.reviews;

CREATE POLICY "Buyers can create reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = buyer_id
  AND EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.ad_id = reviews.ad_id
      AND p.buyer_id = auth.uid()
      AND p.seller_id = reviews.seller_id
  )
);