ALTER TABLE public.circle_sessions
  ADD COLUMN IF NOT EXISTS user_token_expires_at timestamptz;