-- Gates the AI Writer behind the same RBAC page-permission model as
-- search/applications/citizens. Previously any authenticated staff member
-- could generate/save/view AI applications regardless of what an admin
-- had granted them -- ai_applications' RLS only ever checked row
-- ownership (created_by), never whether the caller was allowed to use the
-- feature at all. Admins are unaffected (has_permission() already
-- short-circuits true for them); non-admin staff now need an explicit
-- 'ai_writer' read/write grant, same as every other page.

ALTER TABLE public.permissions DROP CONSTRAINT permissions_page_check;
ALTER TABLE public.permissions ADD CONSTRAINT permissions_page_check
  CHECK (page IN ('search', 'applications', 'citizens', 'ai_writer'));

-- Same (SELECT ...)-wrapped perf pattern as 08-rls-performance.sql --
-- has_permission() takes no row-dependent arguments, so wrapping it lets
-- Postgres evaluate it once per statement (InitPlan) instead of once per
-- row.

DROP POLICY ai_applications_select ON public.ai_applications;
CREATE POLICY ai_applications_select ON public.ai_applications FOR SELECT TO authenticated
  USING (
    (SELECT public.has_permission('ai_writer', 'read'))
    AND ((SELECT public.is_admin()) OR created_by = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  );

DROP POLICY ai_applications_insert ON public.ai_applications;
CREATE POLICY ai_applications_insert ON public.ai_applications FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_permission('ai_writer', 'write'))
    AND (created_by = (SELECT public.current_staff_id()) OR created_by IS NULL)
    AND (SELECT public.aal_satisfied())
  );

DROP POLICY ai_applications_update ON public.ai_applications;
CREATE POLICY ai_applications_update ON public.ai_applications FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_permission('ai_writer', 'write'))
    AND ((SELECT public.is_admin()) OR created_by = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  )
  WITH CHECK (
    (SELECT public.has_permission('ai_writer', 'write'))
    AND ((SELECT public.is_admin()) OR created_by = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  );

DROP POLICY ai_application_versions_select ON public.ai_application_versions;
CREATE POLICY ai_application_versions_select ON public.ai_application_versions FOR SELECT TO authenticated
  USING (
    (SELECT public.has_permission('ai_writer', 'read'))
    AND (SELECT public.aal_satisfied())
    AND EXISTS (
      SELECT 1 FROM public.ai_applications a
      WHERE a.id = application_id
        AND ((SELECT public.is_admin()) OR a.created_by = (SELECT public.current_staff_id()))
    )
  );
