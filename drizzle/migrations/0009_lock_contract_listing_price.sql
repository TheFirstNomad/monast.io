CREATE OR REPLACE FUNCTION public.lock_contract_listing_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.onchain_listing_id IS NOT NULL
     AND NEW.price_usdc IS DISTINCT FROM OLD.price_usdc THEN
    RAISE EXCEPTION 'This listing''s price is set in the escrow contract; delete and relist to change it';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.lock_contract_listing_price() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_lock_contract_listing_price BEFORE UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.lock_contract_listing_price();