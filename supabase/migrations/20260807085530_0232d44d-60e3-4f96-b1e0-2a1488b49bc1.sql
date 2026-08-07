-- 1. Roles ------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'arbitrator', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Reports ----------------------------------------------------------------
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('ad', 'profile', 'escrow')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 80),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX reports_target_idx ON public.reports (target_type, target_id);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'open' AND reviewer_id IS NULL);

CREATE POLICY "Reporters read their own reports"
  ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "Moderators read all reports"
  ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'arbitrator') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators review reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'arbitrator') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'arbitrator') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reporters must not rewrite their own report after filing.
CREATE OR REPLACE FUNCTION public.protect_report_immutables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id THEN RAISE EXCEPTION 'reporter_id is immutable'; END IF;
    IF NEW.target_type IS DISTINCT FROM OLD.target_type THEN RAISE EXCEPTION 'target_type is immutable'; END IF;
    IF NEW.target_id   IS DISTINCT FROM OLD.target_id   THEN RAISE EXCEPTION 'target_id is immutable'; END IF;
    IF NEW.created_at  IS DISTINCT FROM OLD.created_at  THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_report_immutables
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_report_immutables();

-- 3. Internal config (backend only) ----------------------------------------
CREATE TABLE public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_config TO service_role;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
-- No policies: unreachable from the Data API by design.

INSERT INTO public.internal_config (key, value)
VALUES ('cron_token', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 4. Scheduled escrow maintenance ------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.run_escrow_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT value INTO v_token FROM public.internal_config WHERE key = 'cron_token';
  IF v_token IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url := 'https://ndsqyhwsjxlhxuylgdal.supabase.co/functions/v1/escrow-maintenance',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', v_token),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_escrow_maintenance() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'escrow-maintenance-15m',
  '*/15 * * * *',
  $$SELECT public.run_escrow_maintenance();$$
);