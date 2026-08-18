REVOKE INSERT ON public.agents FROM authenticated;
REVOKE INSERT ON public.agents FROM anon;
DROP POLICY IF EXISTS "Owners insert their agents" ON public.agents;