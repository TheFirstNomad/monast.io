GRANT SELECT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
DROP POLICY IF EXISTS "Owners delete their agents" ON public.agents;
CREATE POLICY "Owners delete their agents" ON public.agents FOR DELETE TO authenticated USING (auth.uid() = owner_user_id);