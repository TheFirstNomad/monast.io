-- Keep wallet-internal custody identifiers out of anything other users can read.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (id, display_name, avatar_url, bio, rating, total_ads, wallet_address, created_at, updated_at)
  ON public.profiles TO anon, authenticated;

GRANT INSERT (id, display_name, avatar_url, bio, wallet_address)
  ON public.profiles TO authenticated;

GRANT UPDATE (display_name, avatar_url, bio, wallet_address)
  ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;