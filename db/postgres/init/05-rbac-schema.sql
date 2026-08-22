-- Role-based access control + audit log.
--
-- `authenticated` still gets the blanket table grants from 03/04-schema.sql
-- (PostgREST needs the grant to attempt an operation at all) -- what this
-- file adds is Row Level Security on top, so each request is additionally
-- narrowed by what the calling staff member is actually permitted to do.
--
-- `public.staff` mirrors GoTrue's user records for the pieces the browser
-- needs (username, admin flag). The browser can never call GoTrue's admin
-- API directly (needs JWT_SECRET, only ever used from manage-users.sh on a
-- trusted machine), so this table is what the Admin UI reads/writes via
-- PostgREST instead.

CREATE TABLE IF NOT EXISTS public.staff (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text NOT NULL,
  is_admin    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS staff_set_updated_at ON public.staff;
CREATE TRIGGER staff_set_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: every account created before this migration predates the
-- public.staff mirror row entirely. Without this, enabling RLS below would
-- silently lock out every existing staff member (no row -> is_admin/permission
-- checks all evaluate false). Bringing them in as admins preserves today's
-- status quo (every staff member currently has full access) -- RBAC is
-- meant to let an admin start *restricting* access going forward, not
-- surprise-lock everyone out on migration day. New accounts created after
-- this point via manage-users.sh default to no access, as intended.
INSERT INTO public.staff (id, username, is_admin)
SELECT id, COALESCE(NULLIF(split_part(email, '@', 1), ''), phone, id::text), true
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Search and Applications are controlled independently even though they
-- both operate on the `applications` table (see request_page() below for
-- how that's actually enforced) -- 'citizens' exists for the placeholder
-- page today, ready for whenever real Citizens CRUD is built.
CREATE TABLE IF NOT EXISTS public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  page        text NOT NULL CHECK (page IN ('search', 'applications', 'citizens')),
  can_read    boolean NOT NULL DEFAULT false,
  can_write   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page)
);

DROP TRIGGER IF EXISTS permissions_set_updated_at ON public.permissions;
CREATE TRIGGER permissions_set_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid,
  actor_username text,
  action         text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name     text NOT NULL,
  record_id      uuid,
  old_data       jsonb,
  new_data       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_name_idx ON public.audit_log (table_name);

-- No auth.uid() in this stack (that's a Supabase-Postgres-specific helper,
-- not present in vanilla Postgres) -- read the JWT's `sub` claim directly.
CREATE OR REPLACE FUNCTION public.current_staff_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = public.current_staff_id() AND is_admin)
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_permission(p_page text, p_op text) RETURNS boolean AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.permissions
    WHERE user_id = public.current_staff_id() AND page = p_page
      AND ((p_op = 'read' AND can_read) OR (p_op = 'write' AND can_write))
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Search and Applications both write the same `applications` table, so the
-- frontend declares which page it's acting as via this header -- see the
-- module comment above for the security caveat this implies (enforced
-- against the app's own UI, not a cryptographic separation between the two
-- pages for a client crafting raw API calls).
CREATE OR REPLACE FUNCTION public.request_page() RETURNS text AS $$
  SELECT current_setting('request.headers', true)::json->>'x-page'
$$ LANGUAGE sql STABLE;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY applications_select ON public.applications FOR SELECT TO authenticated
  USING (public.has_permission('search', 'read') OR public.has_permission('applications', 'read'));

CREATE POLICY applications_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(public.request_page(), 'write'));

CREATE POLICY applications_update ON public.applications FOR UPDATE TO authenticated
  USING (public.has_permission(public.request_page(), 'write'))
  WITH CHECK (public.has_permission(public.request_page(), 'write'));

CREATE POLICY applications_delete ON public.applications FOR DELETE TO authenticated
  USING (public.has_permission(public.request_page(), 'write'));

ALTER TABLE public.citizens ENABLE ROW LEVEL SECURITY;

CREATE POLICY citizens_select ON public.citizens FOR SELECT TO authenticated
  USING (public.has_permission('citizens', 'read'));
CREATE POLICY citizens_insert ON public.citizens FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('citizens', 'write'));
CREATE POLICY citizens_update ON public.citizens FOR UPDATE TO authenticated
  USING (public.has_permission('citizens', 'write')) WITH CHECK (public.has_permission('citizens', 'write'));
CREATE POLICY citizens_delete ON public.citizens FOR DELETE TO authenticated
  USING (public.has_permission('citizens', 'write'));

-- Any authenticated staff member can read the (small) staff/permissions
-- list -- needed so a logged-in user can read their own access -- but only
-- admins can write either table.
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_admin_write ON public.staff FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_admin_write ON public.permissions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Admins can read the audit log; there is deliberately no client-facing
-- INSERT/UPDATE/DELETE grant at all -- it's only ever written by the
-- trigger function below, which runs as the table owner (SECURITY
-- DEFINER), bypassing RLS entirely.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.audit_log TO authenticated; -- RLS still restricts to admins
CREATE POLICY audit_log_admin_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.audit_row_change() RETURNS trigger AS $$
DECLARE
  v_actor_id uuid := public.current_staff_id();
  v_actor_username text;
BEGIN
  SELECT username INTO v_actor_username FROM public.staff WHERE id = v_actor_id;
  INSERT INTO public.audit_log (actor_id, actor_username, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_actor_id, v_actor_username, TG_OP, TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS applications_audit ON public.applications;
CREATE TRIGGER applications_audit AFTER INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS citizens_audit ON public.citizens;
CREATE TRIGGER citizens_audit AFTER INSERT OR UPDATE OR DELETE ON public.citizens
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- INSERT on staff deliberately excluded -- rows are only ever created by
-- manage-users.sh connecting directly as postgres, never via PostgREST.
GRANT SELECT, UPDATE ON public.staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
