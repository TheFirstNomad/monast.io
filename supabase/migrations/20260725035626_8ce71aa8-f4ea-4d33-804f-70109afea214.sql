
CREATE OR REPLACE FUNCTION public.guard_escrow_status_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'created'  AND NEW.status IN ('funded','cancelled')) OR
      (OLD.status = 'funded'   AND NEW.status IN ('released','refunded','disputed')) OR
      (OLD.status = 'disputed' AND NEW.status IN ('released','refunded'))
    ) THEN
      RAISE EXCEPTION 'Invalid escrow status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_escrow_status_transitions() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_escrow_status ON public.escrows;
CREATE TRIGGER trg_guard_escrow_status
BEFORE UPDATE ON public.escrows
FOR EACH ROW EXECUTE FUNCTION public.guard_escrow_status_transitions();

DROP TRIGGER IF EXISTS trg_escrows_updated_at ON public.escrows;
CREATE TRIGGER trg_escrows_updated_at
BEFORE UPDATE ON public.escrows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
