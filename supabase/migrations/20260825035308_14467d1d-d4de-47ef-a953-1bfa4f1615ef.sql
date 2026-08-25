-- circle_wallet_address is the user's own public on-chain address - safe
-- for them to read about themselves (RLS already scopes SELECT to own row).
-- circle_user_id stays hidden - that's Circle's internal identifier and has
-- no legitimate reason to be client-visible.
GRANT SELECT (circle_wallet_address) ON public.profiles TO authenticated;