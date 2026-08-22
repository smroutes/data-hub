-- Fix a real production performance regression from 07-mfa-enforcement.sql:
-- search on `applications` (49k rows, unindexed ILIKE) went from fast to
-- hanging after that migration.
--
-- Root cause: `has_permission()`, `aal_satisfied()`, `is_admin()` etc. take
-- no row-dependent arguments (they only look at the caller's JWT/session),
-- but a bare function call in a USING/WITH CHECK clause is still invoked by
-- Postgres once per row it considers -- there is nothing here that
-- correlates with the row, so the planner can't know that on its own.
-- For a 49k-row seq scan (already required since a leading-wildcard ILIKE
-- can't use a btree index), that meant tens of thousands of extra
-- executions of has_permission()/aal_satisfied() per search, each of which
-- runs its own subquery against permissions/staff/auth.mfa_factors.
--
-- Fix: wrap each function call as `(SELECT ...)`. This is Postgres/
-- PostgREST's documented RLS performance pattern -- a subquery with no
-- correlation to the outer row gets planned as an InitPlan and evaluated
-- exactly once per statement, then reused as a cached Param for every row,
-- instead of being re-invoked per row. No behavior change, pure
-- performance fix -- every USING/WITH CHECK clause below is logically
-- identical to what 05/07 set up, just reshaped so Postgres evaluates it
-- once instead of 49,000 times.

DROP POLICY applications_select ON public.applications;
CREATE POLICY applications_select ON public.applications FOR SELECT TO authenticated
  USING (((SELECT public.has_permission('search', 'read')) OR (SELECT public.has_permission('applications', 'read'))) AND (SELECT public.aal_satisfied()));

DROP POLICY applications_insert ON public.applications;
CREATE POLICY applications_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission(public.request_page(), 'write')) AND (SELECT public.aal_satisfied()));

DROP POLICY applications_update ON public.applications;
CREATE POLICY applications_update ON public.applications FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission(public.request_page(), 'write')) AND (SELECT public.aal_satisfied()))
  WITH CHECK ((SELECT public.has_permission(public.request_page(), 'write')) AND (SELECT public.aal_satisfied()));

DROP POLICY applications_delete ON public.applications;
CREATE POLICY applications_delete ON public.applications FOR DELETE TO authenticated
  USING ((SELECT public.has_permission(public.request_page(), 'write')) AND (SELECT public.aal_satisfied()));

DROP POLICY citizens_select ON public.citizens;
CREATE POLICY citizens_select ON public.citizens FOR SELECT TO authenticated
  USING ((SELECT public.has_permission('citizens', 'read')) AND (SELECT public.aal_satisfied()));

DROP POLICY citizens_insert ON public.citizens;
CREATE POLICY citizens_insert ON public.citizens FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('citizens', 'write')) AND (SELECT public.aal_satisfied()));

DROP POLICY citizens_update ON public.citizens;
CREATE POLICY citizens_update ON public.citizens FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('citizens', 'write')) AND (SELECT public.aal_satisfied()))
  WITH CHECK ((SELECT public.has_permission('citizens', 'write')) AND (SELECT public.aal_satisfied()));

DROP POLICY citizens_delete ON public.citizens;
CREATE POLICY citizens_delete ON public.citizens FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('citizens', 'write')) AND (SELECT public.aal_satisfied()));

DROP POLICY staff_select ON public.staff;
CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated
  USING ((SELECT public.aal_satisfied()));

DROP POLICY staff_admin_write ON public.staff;
CREATE POLICY staff_admin_write ON public.staff FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND (SELECT public.aal_satisfied()))
  WITH CHECK ((SELECT public.is_admin()) AND (SELECT public.aal_satisfied()));

DROP POLICY permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated
  USING ((SELECT public.aal_satisfied()));

DROP POLICY permissions_admin_write ON public.permissions;
CREATE POLICY permissions_admin_write ON public.permissions FOR ALL TO authenticated
  USING ((SELECT public.is_admin()) AND (SELECT public.aal_satisfied()))
  WITH CHECK ((SELECT public.is_admin()) AND (SELECT public.aal_satisfied()));

DROP POLICY audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select ON public.audit_log FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) AND (SELECT public.aal_satisfied()));
