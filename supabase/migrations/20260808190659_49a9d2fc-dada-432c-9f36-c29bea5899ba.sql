-- 1. One real deposit transfer can fund at most one escrow.
CREATE UNIQUE INDEX IF NOT EXISTS escrows_deposit_tx_hash_key
  ON public.escrows (lower(deposit_tx_hash))
  WHERE deposit_tx_hash IS NOT NULL;

-- 2. Concurrency guard for owner revenue withdrawals.
CREATE TABLE public.treasury_withdrawal_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  chain_id integer NOT NULL,
  destination_address text NOT NULL,
  amount_usdc numeric NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  circle_transaction_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.treasury_withdrawal_claims TO service_role;
ALTER TABLE public.treasury_withdrawal_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawal claims are service-role only"
  ON public.treasury_withdrawal_claims FOR ALL
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_withdrawal_claims_updated_at
  BEFORE UPDATE ON public.treasury_withdrawal_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Payout alerts: things a human should look at.
CREATE TABLE public.payout_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL,
  escrow_id uuid REFERENCES public.escrows(id) ON DELETE SET NULL,
  circle_transaction_id text,
  idempotency_key text,
  amount_usdc numeric,
  detail text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payout_alerts_dedupe_key
  ON public.payout_alerts (kind, coalesce(idempotency_key, ''), coalesce(circle_transaction_id, ''));

GRANT SELECT, UPDATE ON public.payout_alerts TO authenticated;
GRANT ALL ON public.payout_alerts TO service_role;
ALTER TABLE public.payout_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can view payout alerts"
  ON public.payout_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can resolve payout alerts"
  ON public.payout_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payout_alerts_updated_at
  BEFORE UPDATE ON public.payout_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();