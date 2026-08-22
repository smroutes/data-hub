-- Full name, shown in the UI instead of the bare username once set. A
-- first-time login with no name on file is blocked behind a non-closeable
-- modal (frontend) until one is provided.
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS full_name text;

-- Self-service name update. Deliberately a SECURITY DEFINER function
-- rather than a direct PostgREST PATCH against public.staff -- the table
-- also has an is_admin column, and RLS's row-level USING/CHECK clauses
-- can't cheaply restrict which *columns* a self-update may touch without
-- fragile old-vs-new comparisons. This function only ever updates
-- full_name for the caller's own row, so there's no privilege-escalation
-- surface no matter what a client sends.
CREATE OR REPLACE FUNCTION public.set_my_name(p_name text) RETURNS void AS $$
BEGIN
  UPDATE public.staff
  SET full_name = NULLIF(btrim(p_name), '')
  WHERE id = public.current_staff_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.set_my_name(text) TO authenticated;
