
-- Extend profiles with Circle wallet identifiers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS circle_user_id text,
  ADD COLUMN IF NOT EXISTS circle_wallet_address text;

-- ============ user_wallets ============
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('email_circle','external')),
  chain_id integer,
  is_primary boolean NOT NULL DEFAULT false,
  label text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, address)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_wallets TO authenticated;
GRANT ALL ON public.user_wallets TO service_role;

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_wallets_select_own" ON public.user_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_wallets_insert_own" ON public.user_wallets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_wallets_update_own" ON public.user_wallets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_wallets_delete_own" ON public.user_wallets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only one primary per user
CREATE UNIQUE INDEX IF NOT EXISTS user_wallets_one_primary
  ON public.user_wallets (user_id) WHERE is_primary;

-- ============ escrows ============
CREATE TABLE IF NOT EXISTS public.escrows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  circle_escrow_id text,
  chain_id integer NOT NULL,
  amount_usdc numeric(20,6) NOT NULL CHECK (amount_usdc > 0),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','funded','released','refunded','disputed','cancelled')),
  deposit_tx_hash text,
  release_tx_hash text,
  refund_tx_hash text,
  tx_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  funded_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.escrows TO authenticated;
GRANT ALL ON public.escrows TO service_role;

ALTER TABLE public.escrows ENABLE ROW LEVEL SECURITY;

-- Buyer or seller can read their own escrows. All writes go through edge functions (service_role).
CREATE POLICY "escrows_select_participant" ON public.escrows
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE INDEX IF NOT EXISTS escrows_ad_id_idx ON public.escrows(ad_id);
CREATE INDEX IF NOT EXISTS escrows_buyer_id_idx ON public.escrows(buyer_id);
CREATE INDEX IF NOT EXISTS escrows_seller_id_idx ON public.escrows(seller_id);

CREATE TRIGGER trg_escrows_updated_at
  BEFORE UPDATE ON public.escrows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
