-- Belt-and-braces: ensure Circle identifiers are not client-readable at all
REVOKE SELECT (circle_user_id, circle_wallet_address) ON public.profiles FROM anon, authenticated;

-- Wallet address: signed-in users only (needed for checkout/payout), never anon
REVOKE SELECT (wallet_address) ON public.profiles FROM anon;
GRANT SELECT (wallet_address) ON public.profiles TO authenticated;

-- Public-safe columns remain readable
GRANT SELECT (id, display_name, avatar_url, bio, rating, total_ads, created_at, updated_at)
  ON public.profiles TO anon, authenticated;

COMMENT ON TABLE public.profiles IS
  'Column-level security: circle_user_id/circle_wallet_address are server-only (no anon/authenticated grants); wallet_address is authenticated-only; other columns are public.';
