-- treasury_wallets holds the platform's own escrow/revenue wallet records,
-- including Circle wallet ids. It is service-role-only by design. We add an
-- explicit deny-all policy so the intent is documented in the schema rather
-- than implied by the absence of policies.
REVOKE ALL ON public.treasury_wallets FROM anon, authenticated;
GRANT ALL ON public.treasury_wallets TO service_role;

DROP POLICY IF EXISTS "Treasury wallets are server-only" ON public.treasury_wallets;
CREATE POLICY "Treasury wallets are server-only"
  ON public.treasury_wallets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);