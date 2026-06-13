
-- 1. Add featured expiry to ads
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS featured_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_ads_featured_until
  ON public.ads (featured_until)
  WHERE featured = true;

-- 2. Promotions table
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  tier text NOT NULL CHECK (tier IN ('24h','7d','30d')),
  price_usdc numeric(20,6) NOT NULL CHECK (price_usdc > 0),
  tx_hash text UNIQUE,
  chain_id integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO service_role;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Public read so the Spotlight & badges work for anonymous visitors.
CREATE POLICY "Anyone can view promotions"
  ON public.promotions FOR SELECT
  USING (true);

-- Writes happen exclusively through the promote-checkout edge function (service role).
-- No INSERT/UPDATE/DELETE policies for authenticated users.

CREATE INDEX idx_promotions_ad_id ON public.promotions (ad_id);
CREATE INDEX idx_promotions_owner ON public.promotions (owner_user_id);
CREATE INDEX idx_promotions_active ON public.promotions (status, ends_at);

CREATE TRIGGER trg_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
