REVOKE ALL ON public.internal_config FROM anon, authenticated;
GRANT ALL ON public.internal_config TO service_role;

CREATE POLICY "No client access to internal config"
  ON public.internal_config FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);