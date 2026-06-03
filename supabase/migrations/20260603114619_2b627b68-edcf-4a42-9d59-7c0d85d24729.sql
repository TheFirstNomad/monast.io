CREATE TABLE public.siwe_nonces (
  nonce text PRIMARY KEY,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

GRANT ALL ON public.siwe_nonces TO service_role;

ALTER TABLE public.siwe_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client reads siwe_nonces" ON public.siwe_nonces FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "No client inserts siwe_nonces" ON public.siwe_nonces FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates siwe_nonces" ON public.siwe_nonces FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "No client deletes siwe_nonces" ON public.siwe_nonces FOR DELETE TO anon, authenticated USING (false);

CREATE INDEX idx_siwe_nonces_created_at ON public.siwe_nonces(created_at);