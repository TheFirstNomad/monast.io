ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS onchain_listing_id text;
CREATE UNIQUE INDEX IF NOT EXISTS ads_onchain_listing_id_key ON public.ads (lower(onchain_listing_id)) WHERE onchain_listing_id IS NOT NULL;
ALTER TABLE public.escrows ADD COLUMN IF NOT EXISTS settlement text NOT NULL DEFAULT 'treasury';
ALTER TABLE public.escrows ADD COLUMN IF NOT EXISTS onchain_escrow_id text;
ALTER TABLE public.escrows ADD CONSTRAINT escrows_settlement_check CHECK (settlement IN ('treasury','contract'));
CREATE UNIQUE INDEX IF NOT EXISTS escrows_onchain_escrow_id_key ON public.escrows (lower(onchain_escrow_id)) WHERE onchain_escrow_id IS NOT NULL;