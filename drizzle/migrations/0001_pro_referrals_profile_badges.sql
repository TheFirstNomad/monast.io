ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_until timestamptz;

CREATE TABLE IF NOT EXISTS public.pro_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  amount_usdc numeric NOT NULL,
  tx_hash text,
  status text NOT NULL DEFAULT 'active'
);
GRANT SELECT, INSERT ON public.pro_subscriptions TO authenticated;
GRANT ALL ON public.pro_subscriptions TO service_role;
ALTER TABLE public.pro_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pro subscriptions" ON public.pro_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own pro subscriptions" ON public.pro_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id),
  referred_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  credited boolean NOT NULL DEFAULT false,
  reward_usdc numeric NOT NULL DEFAULT 0.10
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrers view own referrals" ON public.referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid());