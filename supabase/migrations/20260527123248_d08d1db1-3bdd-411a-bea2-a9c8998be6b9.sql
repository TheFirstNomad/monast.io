
REVOKE EXECUTE ON FUNCTION public.guard_offer_status_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_offer_immutables() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_seller_featured_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_profile_total_ads() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_seller_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_agent_rate_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_admin_sig_nonces() FROM PUBLIC, anon, authenticated;
