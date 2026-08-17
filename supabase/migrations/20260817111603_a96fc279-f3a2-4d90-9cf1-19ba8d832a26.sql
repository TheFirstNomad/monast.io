DROP POLICY IF EXISTS "Authenticated users can create ads" ON public.ads;
CREATE POLICY "Authenticated users can create ads"
ON public.ads FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = seller_id
  AND status = 'pending_fee'
  AND featured = false
  AND featured_until IS NULL
  AND listing_fee_usdc = 0
  AND listing_fee_tx_hash IS NULL
  AND listing_fee_paid_at IS NULL
  AND listing_fee_chain_id IS NULL
  AND sold_at IS NULL
);

DROP POLICY IF EXISTS "Sellers can update their own ads" ON public.ads;
CREATE POLICY "Sellers can update their own ads"
ON public.ads FOR UPDATE TO authenticated
USING (auth.uid() = seller_id)
WITH CHECK (
  auth.uid() = seller_id
  AND status IN ('pending_fee','active','reserved','sold','removed')
  AND featured_until IS NULL
  AND listing_fee_chain_id IS NOT DISTINCT FROM listing_fee_chain_id
);

REVOKE SELECT (circle_user_id, circle_wallet_address) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (circle_user_id, circle_wallet_address) ON public.profiles FROM anon, authenticated;