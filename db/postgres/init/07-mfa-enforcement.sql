-- TOTP two-factor authentication enforcement.
--
-- GoTrue (supabase/auth) already has full native TOTP MFA support
-- (POST /auth/factors to enroll, /challenge + /verify to confirm/step-up,
-- DELETE to unenroll) -- nothing custom needed for the OTP mechanics
-- themselves. What GoTrue does NOT do is stop a plain password-grant login
-- from returning a usable (aal1) token regardless of MFA status; real
-- enforcement needs every RLS policy to additionally require an aal2
-- token for accounts that have a verified factor.

-- SECURITY DEFINER, owned by postgres -- a real superuser in this
-- container (see pg_roles.rolsuper), so this can read auth.mfa_factors
-- without needing any grant on the `auth` schema, which
-- supabase_auth_admin otherwise exclusively owns.
CREATE OR REPLACE FUNCTION public.has_verified_mfa(p_user_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors WHERE user_id = p_user_id AND status = 'verified'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.current_aal() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'aal'
$$ LANGUAGE sql STABLE;

-- Accounts with no verified factor are unaffected (aal1 is fine); accounts
-- that have enrolled MFA must present an aal2 token on every request.
CREATE OR REPLACE FUNCTION public.aal_satisfied() RETURNS boolean AS $$
  SELECT NOT public.has_verified_mfa(public.current_staff_id()) OR public.current_aal() = 'aal2'
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Every existing RLS policy from 05-rbac-schema.sql, re-created with
-- "AND public.aal_satisfied()" appended -- no other logic changes.
-- (Postgres has no ALTER POLICY ... ADD CONDITION, so this is drop+recreate.)

DROP POLICY applications_select ON public.applications;
CREATE POLICY applications_select ON public.applications FOR SELECT TO authenticated
  USING ((public.has_permission('search', 'read') OR public.has_permission('applications', 'read')) AND public.aal_satisfied());

DROP POLICY applications_insert ON public.applications;
CREATE POLICY applications_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(public.request_page(), 'write') AND public.aal_satisfied());

DROP POLICY applications_update ON public.applications;
CREATE POLICY applications_update ON public.applications FOR UPDATE TO authenticated
  USING (public.has_permission(public.request_page(), 'write') AND public.aal_satisfied())
  WITH CHECK (public.has_permission(public.request_page(), 'write') AND public.aal_satisfied());

DROP POLICY applications_delete ON public.applications;
CREATE POLICY applications_delete ON public.applications FOR DELETE TO authenticated
  USING (public.has_permission(public.request_page(), 'write') AND public.aal_satisfied());

DROP POLICY citizens_select ON public.citizens;
CREATE POLICY citizens_select ON public.citizens FOR SELECT TO authenticated
  USING (public.has_permission('citizens', 'read') AND public.aal_satisfied());

DROP POLICY citizens_insert ON public.citizens;
CREATE POLICY citizens_insert ON public.citizens FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('citizens', 'write') AND public.aal_satisfied());

DROP POLICY citizens_update ON public.citizens;
CREATE POLICY citizens_update ON public.citizens FOR UPDATE TO authenticated
  USING (public.has_permission('citizens', 'write') AND public.aal_satisfied())
  WITH CHECK (public.has_permission('citizens', 'write') AND public.aal_satisfied());

DROP POLICY citizens_delete ON public.citizens;
CREATE POLICY citizens_delete ON public.citizens FOR DELETE TO authenticated
  USING (public.has_permission('citizens', 'write') AND public.aal_satisfied());

DROP POLICY staff_select ON public.staff;
CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated
  USING (public.aal_satisfied());

DROP POLICY staff_admin_write ON public.staff;
CREATE POLICY staff_admin_write ON public.staff FOR UPDATE TO authenticated
  USING (public.is_admin() AND public.aal_satisfied())
  WITH CHECK (public.is_admin() AND public.aal_satisfied());

DROP POLICY permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated
  USING (public.aal_satisfied());

DROP POLICY permissions_admin_write ON public.permissions;
CREATE POLICY permissions_admin_write ON public.permissions FOR ALL TO authenticated
  USING (public.is_admin() AND public.aal_satisfied())
  WITH CHECK (public.is_admin() AND public.aal_satisfied());

DROP POLICY audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin() AND public.aal_satisfied());
