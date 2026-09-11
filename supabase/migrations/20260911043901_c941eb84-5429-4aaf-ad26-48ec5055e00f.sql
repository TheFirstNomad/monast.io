-- 1. Atomic agent rate limiter: insert first, then count, so concurrent
-- requests can never both read a stale under-limit count.
CREATE OR REPLACE FUNCTION public.agent_rate_limit_hit(
  _bucket text,
  _endpoint text,
  _limit integer
)
RETURNS TABLE (allowed boolean, used integer, lim integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
BEGIN
  INSERT INTO public.agent_rate_limits (bucket_key, endpoint)
  VALUES (_bucket, _endpoint);

  SELECT count(*)::int INTO v_used
  FROM public.agent_rate_limits
  WHERE bucket_key = _bucket
    AND created_at >= now() - interval '1 minute';

  RETURN QUERY SELECT (v_used <= _limit), v_used, _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_rate_limit_hit(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_rate_limit_hit(text, text, integer) TO service_role;

-- 2. Atomic agent payment recording with a daily spend cap enforced at
-- payment time. The agents row is locked for the transaction so two
-- concurrent payments cannot both pass the cap check.
CREATE OR REPLACE FUNCTION public.agent_record_payment(
  _agent_id uuid,
  _ad_id uuid,
  _seller_id uuid,
  _buyer_id uuid,
  _amount numeric,
  _tx_hash text,
  _chain_id integer
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap numeric;
  v_spent numeric;
  v_row public.payments;
BEGIN
  SELECT max_spend_usdc_per_day INTO v_cap
  FROM public.agents WHERE id = _agent_id FOR UPDATE;

  IF v_cap IS NULL THEN
    RAISE EXCEPTION 'agent_not_found';
  END IF;

  SELECT COALESCE(sum(amount_usdc), 0) INTO v_spent
  FROM public.payments
  WHERE buyer_id = _buyer_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');

  IF v_spent + _amount > v_cap THEN
    RAISE EXCEPTION 'spend_cap_exceeded:%:%', v_spent, v_cap;
  END IF;

  INSERT INTO public.payments (ad_id, seller_id, buyer_id, amount_usdc, tx_hash, chain_id)
  VALUES (_ad_id, _seller_id, _buyer_id, _amount, _tx_hash, _chain_id)
  RETURNING * INTO v_row;

  UPDATE public.ads
     SET status = 'sold', sold_at = now()
   WHERE id = _ad_id;

  UPDATE public.agents
     SET reputation_score = reputation_score + 1
   WHERE id = _agent_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_record_payment(uuid, uuid, uuid, uuid, numeric, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_record_payment(uuid, uuid, uuid, uuid, numeric, text, integer) TO service_role;

-- 3. Server-managed reputation adjustment (used for the documented -5
-- penalty when an agent cancels an offer that was already accepted).
CREATE OR REPLACE FUNCTION public.agent_reputation_delta(_agent_id uuid, _delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer;
BEGIN
  UPDATE public.agents
     SET reputation_score = reputation_score + _delta
   WHERE id = _agent_id
   RETURNING reputation_score INTO v_score;
  RETURN v_score;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_reputation_delta(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_reputation_delta(uuid, integer) TO service_role;

-- 4. Schedule the cleanup routines that were written but never scheduled.
SELECT cron.schedule(
  'agent-rate-limit-cleanup-hourly',
  '17 * * * *',
  $$SELECT public.cleanup_agent_rate_limits();$$
);

SELECT cron.schedule(
  'admin-sig-nonce-cleanup-daily',
  '23 3 * * *',
  $$SELECT public.cleanup_admin_sig_nonces();$$
);