-- Reserved and sold ads must stay readable: a buyer with money in escrow needs
-- to open the item page, and completed sales remain viewable for history and
-- reviews. Ads awaiting their listing fee stay private to the seller.
DROP POLICY IF EXISTS "Active ads are viewable by everyone" ON public.ads;
CREATE POLICY "Published ads are viewable by everyone"
  ON public.ads
  FOR SELECT
  USING (
    status IN ('active', 'reserved', 'sold')
    OR auth.uid() = seller_id
  );

-- A seller can only ever create an ad in the unpaid state.
DROP POLICY IF EXISTS "Authenticated users can create ads" ON public.ads;
CREATE POLICY "Authenticated users can create ads"
  ON public.ads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id AND status = 'pending_fee');