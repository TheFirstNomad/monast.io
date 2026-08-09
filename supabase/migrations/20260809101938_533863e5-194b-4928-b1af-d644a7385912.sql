ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

REVOKE DELETE ON public.messages FROM authenticated;
REVOKE DELETE ON public.messages FROM anon;