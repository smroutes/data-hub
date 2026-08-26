-- Gates the new CSV/XLSX export button on the Applications page behind
-- its own dedicated permission, deliberately separate from the existing
-- 'applications' page-visibility permission. Exporting a bulk file of
-- name/mobile/Aadhaar/address is a meaningfully bigger privacy exposure
-- than viewing one row at a time in the UI -- staff who can see the
-- Applications page do not automatically get to export it; someone with
-- admin (or an explicit grant here) has to turn this on separately.
--
-- This is a frontend-enforced gate (the Download button itself checks
-- has_permission('applications_export', 'read') via useAuth().can()),
-- not a stronger row-level restriction than 'applications' already
-- provides -- the export reads the exact same applications rows through
-- the exact same existing SELECT policy, just formatted into a file
-- instead of a table. Same has_permission()/RBAC pattern as every other
-- page-gated feature in this app (ai_writer, citizens, etc.).

ALTER TABLE public.permissions DROP CONSTRAINT permissions_page_check;
ALTER TABLE public.permissions ADD CONSTRAINT permissions_page_check
  CHECK (page IN ('search', 'applications', 'citizens', 'ai_writer', 'applications_export'));
