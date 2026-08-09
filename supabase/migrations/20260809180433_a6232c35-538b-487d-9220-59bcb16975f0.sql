-- 1) Inline role checks in policies so signed-in users no longer need EXECUTE on definer helpers
DROP POLICY IF EXISTS "admins can view payout alerts" ON public.payout_alerts;
CREATE POLICY "admins can view payout alerts" ON public.payout_alerts
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role));

DROP POLICY IF EXISTS "admins can resolve payout alerts" ON public.payout_alerts;
CREATE POLICY "admins can resolve payout alerts" ON public.payout_alerts
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role));

DROP POLICY IF EXISTS "Moderators read all reports" ON public.reports;
CREATE POLICY "Moderators read all reports" ON public.reports
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('moderator'::app_role,'arbitrator'::app_role,'admin'::app_role)));

DROP POLICY IF EXISTS "Moderators review reports" ON public.reports;
CREATE POLICY "Moderators review reports" ON public.reports
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('moderator'::app_role,'arbitrator'::app_role,'admin'::app_role)))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('moderator'::app_role,'arbitrator'::app_role,'admin'::app_role)));

DROP POLICY IF EXISTS "Moderators can take listings down" ON public.ads;
CREATE POLICY "Moderators can take listings down" ON public.ads
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('moderator'::app_role,'arbitrator'::app_role,'admin'::app_role)))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('moderator'::app_role,'arbitrator'::app_role,'admin'::app_role))
  AND status = 'removed'
);

-- 2) Signed-in users can no longer call the SECURITY DEFINER helpers directly
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_circle_user_id() FROM authenticated, anon, PUBLIC;

-- 3) Escrows stay server-write-only, but make the intent explicit and fail-closed
REVOKE INSERT, UPDATE, DELETE ON public.escrows FROM authenticated, anon;
GRANT SELECT ON public.escrows TO authenticated;
GRANT ALL ON public.escrows TO service_role;