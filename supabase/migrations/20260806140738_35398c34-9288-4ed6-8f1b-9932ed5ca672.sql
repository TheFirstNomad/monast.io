-- 1. Treasury wallets (server-only)
CREATE TABLE public.treasury_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('escrow','revenue')),
  chain_id INTEGER NOT NULL,
  circle_blockchain TEXT NOT NULL,
  circle_wallet_id TEXT,
  circle_wallet_set_id TEXT,
  address TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (purpose, chain_id)
);

GRANT ALL ON public.treasury_wallets TO service_role;
ALTER TABLE public.treasury_wallets ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: backend-only by design.

CREATE TRIGGER trg_treasury_wallets_updated_at
BEFORE UPDATE ON public.treasury_wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Ledger (append-only record of every USDC movement)
CREATE TABLE public.ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('escrow_deposit','seller_payout','buyer_refund','platform_fee','listing_fee','promotion_fee','revenue_withdrawal')),
  escrow_id UUID REFERENCES public.escrows(id) ON DELETE SET NULL,
  ad_id UUID REFERENCES public.ads(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  chain_id INTEGER NOT NULL,
  amount_usdc NUMERIC NOT NULL CHECK (amount_usdc > 0),
  tx_hash TEXT,
  circle_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','failed')),
  idempotency_key TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_escrow ON public.ledger_entries (escrow_id);
CREATE INDEX idx_ledger_kind_created ON public.ledger_entries (kind, created_at DESC);

GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view their own ledger entries"
ON public.ledger_entries FOR SELECT TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE TRIGGER trg_ledger_updated_at
BEFORE UPDATE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Escrow fee + cancellation + payout fields
ALTER TABLE public.escrows
  ADD COLUMN platform_fee_usdc NUMERIC NOT NULL DEFAULT 0 CHECK (platform_fee_usdc >= 0),
  ADD COLUMN seller_net_usdc NUMERIC,
  ADD COLUMN cancel_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN cancel_reason TEXT,
  ADD COLUMN delivery_marked_at TIMESTAMPTZ,
  ADD COLUMN auto_release_at TIMESTAMPTZ,
  ADD COLUMN payout_status TEXT NOT NULL DEFAULT 'none' CHECK (payout_status IN ('none','pending','sent','confirmed','failed')),
  ADD COLUMN payout_circle_tx_id TEXT,
  ADD COLUMN payout_started_at TIMESTAMPTZ;

-- 4. Listing fee tracking on ads
ALTER TABLE public.ads
  ADD COLUMN listing_fee_usdc NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN listing_fee_tx_hash TEXT,
  ADD COLUMN listing_fee_paid_at TIMESTAMPTZ,
  ADD COLUMN listing_fee_chain_id INTEGER;

CREATE UNIQUE INDEX idx_ads_listing_fee_tx ON public.ads (lower(listing_fee_tx_hash))
  WHERE listing_fee_tx_hash IS NOT NULL;

-- Sellers must not self-award a paid listing fee.
CREATE OR REPLACE FUNCTION public.guard_ads_listing_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.listing_fee_usdc := 0;
    NEW.listing_fee_tx_hash := NULL;
    NEW.listing_fee_paid_at := NULL;
    NEW.listing_fee_chain_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.listing_fee_usdc IS DISTINCT FROM OLD.listing_fee_usdc
     OR NEW.listing_fee_tx_hash IS DISTINCT FROM OLD.listing_fee_tx_hash
     OR NEW.listing_fee_paid_at IS DISTINCT FROM OLD.listing_fee_paid_at
     OR NEW.listing_fee_chain_id IS DISTINCT FROM OLD.listing_fee_chain_id THEN
    RAISE EXCEPTION 'listing fee fields are set by the payment verifier only';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_ads_listing_fee() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_ads_listing_fee
BEFORE INSERT OR UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.guard_ads_listing_fee();

-- 5. Fee settings (public read)
CREATE TABLE public.fee_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value NUMERIC NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fee_settings TO anon, authenticated;
GRANT ALL ON public.fee_settings TO service_role;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fee settings"
ON public.fee_settings FOR SELECT
USING (true);

CREATE TRIGGER trg_fee_settings_updated_at
BEFORE UPDATE ON public.fee_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.fee_settings (key, value, description) VALUES
  ('listing_fee_usdc', 0.15, 'Flat anti-spam fee charged per published ad, in USDC'),
  ('sale_fee_bps', 100, 'Platform fee on a successful sale, in basis points (100 = 1%)'),
  ('delivery_window_hours', 72, 'Hours after delivery is marked before an escrow auto-releases'),
  ('cancel_response_hours', 48, 'Hours the seller has to answer a buyer cancellation request');
