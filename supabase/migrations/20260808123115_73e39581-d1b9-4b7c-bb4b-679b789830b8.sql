-- Column-level lockdown of Circle identifiers on profiles
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, display_name, avatar_url, bio, wallet_address, rating, total_ads, created_at, updated_at)
  ON public.profiles TO anon, authenticated;

GRANT ALL ON public.profiles TO service_role;

-- Owner-only accessor for their own Circle user id
CREATE OR REPLACE FUNCTION public.my_circle_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT circle_user_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_circle_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_circle_user_id() TO authenticated;
