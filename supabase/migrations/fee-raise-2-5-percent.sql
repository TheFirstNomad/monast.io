-- Raise platform sale fee from 1% (100 bps) to 2.5% (250 bps).
-- The fee_settings table is the live source of truth read by Edge Functions.
-- The constants in src/lib/fees.ts and supabase/functions/_shared/fees.ts
-- are fallbacks only; this row takes precedence at runtime.
--
-- TO APPLY: paste this into Supabase Dashboard → SQL Editor → Run.
-- Only affects NEW escrow releases after this runs; in-flight escrows
-- already have amounts locked and are not retroactively affected.

INSERT INTO fee_settings (key, value, updated_at)
VALUES ('sale_fee_bps', 250, now())
ON CONFLICT (key) DO UPDATE
  SET value = 250,
      updated_at = now();

-- Verify:
-- SELECT key, value FROM fee_settings WHERE key = 'sale_fee_bps';
