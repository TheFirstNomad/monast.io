CREATE INDEX IF NOT EXISTS ads_active_created_idx
  ON public.ads (created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS ads_status_category_created_idx
  ON public.ads (status, category, created_at DESC);

CREATE INDEX IF NOT EXISTS offers_ad_idx ON public.offers (ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS offers_buyer_idx ON public.offers (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON public.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_created_idx ON public.messages (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS escrows_status_idx ON public.escrows (status);
CREATE INDEX IF NOT EXISTS escrows_auto_release_idx
  ON public.escrows (auto_release_at)
  WHERE status = 'funded';

CREATE INDEX IF NOT EXISTS reviews_seller_idx ON public.reviews (seller_id, created_at DESC);