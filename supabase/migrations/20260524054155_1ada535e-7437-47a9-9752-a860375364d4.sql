-- Admin signature replay protection
CREATE TABLE IF NOT EXISTS public.admin_sig_nonces (
  signature text PRIMARY KEY,
  admin_address text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_sig_nonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client reads admin_sig_nonces"   ON public.admin_sig_nonces FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "No client inserts admin_sig_nonces" ON public.admin_sig_nonces FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates admin_sig_nonces" ON public.admin_sig_nonces FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "No client deletes admin_sig_nonces" ON public.admin_sig_nonces FOR DELETE TO anon, authenticated USING (false);
CREATE INDEX IF NOT EXISTS admin_sig_nonces_used_at_idx ON public.admin_sig_nonces (used_at);

-- Rate-limit window table
CREATE TABLE IF NOT EXISTS public.agent_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_rate_limits_bucket_idx ON public.agent_rate_limits(bucket_key, endpoint, created_at DESC);
ALTER TABLE public.agent_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client reads agent_rate_limits"   ON public.agent_rate_limits FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "No client inserts agent_rate_limits" ON public.agent_rate_limits FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates agent_rate_limits" ON public.agent_rate_limits FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "No client deletes agent_rate_limits" ON public.agent_rate_limits FOR DELETE TO anon, authenticated USING (false);

-- Cleanup helpers
CREATE OR REPLACE FUNCTION public.cleanup_admin_sig_nonces()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_sig_nonces WHERE used_at < now() - interval '1 day';
$$;

CREATE OR REPLACE FUNCTION public.cleanup_agent_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.agent_rate_limits WHERE created_at < now() - interval '24 hours';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_admin_sig_nonces() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_agent_rate_limits() FROM PUBLIC, anon, authenticated;