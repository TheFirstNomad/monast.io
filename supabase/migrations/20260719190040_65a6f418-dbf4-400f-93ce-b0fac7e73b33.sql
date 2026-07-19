-- Deduplicate any legacy rows sharing a tx_hash (keep the earliest).
DELETE FROM public.payments p
USING public.payments q
WHERE lower(p.tx_hash) = lower(q.tx_hash)
  AND p.created_at > q.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS payments_tx_hash_key ON public.payments (lower(tx_hash));

DROP POLICY IF EXISTS "Buyers can insert their payments" ON public.payments;
