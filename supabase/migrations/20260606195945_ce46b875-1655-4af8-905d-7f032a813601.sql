
DO $$ BEGIN
  CREATE TYPE public.agent_kind AS ENUM ('delegated','standalone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.agent_kind NOT NULL DEFAULT 'delegated',
  display_name text NOT NULL,
  wallet_address text NOT NULL,
  api_key_hash text NOT NULL UNIQUE,
  api_key_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked')),
  max_spend_usdc_per_day numeric NOT NULL DEFAULT 100,
  reputation_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their agents"
  ON public.agents FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners insert their agents"
  ON public.agents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id AND kind = 'delegated');

CREATE POLICY "Owners update their agents"
  ON public.agents FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX agents_owner_idx ON public.agents(owner_user_id);

CREATE TABLE public.agent_activity (
  id bigserial PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code int NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_activity TO authenticated;
GRANT ALL ON public.agent_activity TO service_role;

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their agent activity"
  ON public.agent_activity FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = agent_activity.agent_id AND a.owner_user_id = auth.uid()
  ));

CREATE INDEX agent_activity_agent_idx ON public.agent_activity(agent_id, created_at DESC);
