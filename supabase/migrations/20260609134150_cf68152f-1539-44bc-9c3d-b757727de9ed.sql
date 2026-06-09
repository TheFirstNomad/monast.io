
-- 1) Hide api_key_hash from end users (defense in depth against offline cracking).
-- Service role retains full access; backend uses service_role to authenticate API keys.
REVOKE SELECT ON public.agents FROM authenticated;
GRANT SELECT (
  id, owner_user_id, kind, display_name, wallet_address,
  api_key_prefix, status, max_spend_usdc_per_day,
  reputation_score, created_at, updated_at
) ON public.agents TO authenticated;

-- 2) Restrict offer updates to the status column only.
-- Triggers (guard_offer_status_changes, protect_offer_immutables) already enforce
-- which transitions are allowed; column-level grant adds defense in depth at RLS.
REVOKE UPDATE ON public.offers FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.offers TO authenticated;

-- Replace the single combined UPDATE policy with explicit buyer / seller policies
-- scoped to their respective allowed transitions (existing trigger remains the
-- authoritative check).
DROP POLICY IF EXISTS "Buyer or seller can update offer" ON public.offers;

CREATE POLICY "Seller can update offer status"
ON public.offers
FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT seller_id FROM public.ads WHERE id = offers.ad_id))
WITH CHECK (auth.uid() IN (SELECT seller_id FROM public.ads WHERE id = offers.ad_id));

CREATE POLICY "Buyer can update own offer status"
ON public.offers
FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);
