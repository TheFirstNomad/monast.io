ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS circle_wallet_id text;
ALTER TABLE public.user_wallets ADD COLUMN IF NOT EXISTS circle_wallet_id text;

CREATE TABLE IF NOT EXISTS public.circle_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.circle_sessions TO service_role;
ALTER TABLE public.circle_sessions ENABLE ROW LEVEL SECURITY;