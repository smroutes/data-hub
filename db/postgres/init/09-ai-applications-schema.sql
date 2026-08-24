-- AI Writer: saved/draft applications generated from frontend/src/pages/
-- AIApplicationWriter.tsx, plus their full version history.
--
-- Distinct from `public.applications` (04-applications-schema.sql), which
-- is the unrelated Annapurna Scheme citizen-intake table -- naming these
-- `ai_applications` / `ai_application_versions` to avoid any collision.
--
-- Content is stored as markdown, not Plate's internal JSON node tree --
-- that's exactly the format ApplicationEditor already round-trips through
-- via editor.api.markdown.serialize()/deserialize() and `initialMarkdown`,
-- so loading a saved row back into the editor needs zero new
-- (de)serialization logic on the frontend.

CREATE TABLE IF NOT EXISTS public.ai_applications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE, -- short public id for /ai-writer/<slug>; server-generated below
  title                 text NOT NULL DEFAULT 'AI Generated Application',
  prompt                text NOT NULL, -- the generation description -- stored, never rendered in the list UI
  language              text NOT NULL CHECK (language IN ('bn', 'en', 'hi')),
  category              text,
  content_markdown      text NOT NULL DEFAULT '',
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'archived')),

  -- Optimistic-concurrency counter. Server-owned (see the bump trigger
  -- below) -- a client never sets this directly, it only sends the
  -- *expected current* value as a `?version=eq.<n>` filter on PATCH. If
  -- another write already bumped it, that filter matches zero rows and
  -- PostgREST reports zero rows updated -- the frontend's conflict signal.
  version               integer NOT NULL DEFAULT 1,

  -- Cumulative token spend across this document's lifetime, split by call
  -- type. Populated from the `usage.total_tokens` DeepSeek/Groq already
  -- return (see app/main.py) and folded in by the frontend on each save.
  suggest_tokens_used   integer NOT NULL DEFAULT 0,
  generate_tokens_used  integer NOT NULL DEFAULT 0,

  created_by            uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  updated_by            uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_applications_created_by_idx ON public.ai_applications (created_by);
CREATE INDEX IF NOT EXISTS ai_applications_status_idx     ON public.ai_applications (status);
CREATE INDEX IF NOT EXISTS ai_applications_updated_at_idx ON public.ai_applications (updated_at DESC);

-- Append-only snapshot history -- one row per save (both the automatic
-- draft-on-generate and every explicit Save), populated purely by a
-- trigger below so the frontend never has to remember to write to two
-- tables; a single INSERT/PATCH to ai_applications is sufficient.
CREATE TABLE IF NOT EXISTS public.ai_application_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    uuid NOT NULL REFERENCES public.ai_applications(id) ON DELETE CASCADE,
  version           integer NOT NULL,
  title             text NOT NULL,
  content_markdown  text NOT NULL,
  language          text NOT NULL,
  category          text,
  status            text NOT NULL,
  saved_by          uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_application_versions_app_id_idx
  ON public.ai_application_versions (application_id, created_at DESC);

-- Never trust a client-supplied created_by -- default it from the caller's
-- own JWT. updated_by starts equal to created_by (the creator is also the
-- first "last editor").
CREATE OR REPLACE FUNCTION public.ai_applications_set_created_by() RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := public.current_staff_id();
  END IF;
  NEW.updated_by := NEW.created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ai_applications_00_set_created_by ON public.ai_applications;
CREATE TRIGGER ai_applications_00_set_created_by BEFORE INSERT ON public.ai_applications
  FOR EACH ROW EXECUTE FUNCTION public.ai_applications_set_created_by();

-- 8-char hex public id, retried on the (extremely unlikely) chance of a
-- collision. pgcrypto (for gen_random_bytes) is already enabled by
-- 03-schema.sql; CREATE EXTENSION here too defensively, a no-op if present.
-- (Postgres's built-in encode() only supports base64/hex/escape -- no
-- base32 -- hex is used here since it needs no further character
-- stripping, unlike base64's +/= characters.)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.ai_applications_generate_slug() RETURNS trigger AS $$
DECLARE
  candidate text;
  attempt   int := 0;
BEGIN
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := encode(gen_random_bytes(4), 'hex');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ai_applications WHERE slug = candidate);
    attempt := attempt + 1;
    IF attempt > 5 THEN
      RAISE EXCEPTION 'could not generate a unique ai_applications slug';
    END IF;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ai_applications_01_set_slug ON public.ai_applications;
CREATE TRIGGER ai_applications_01_set_slug BEFORE INSERT ON public.ai_applications
  FOR EACH ROW EXECUTE FUNCTION public.ai_applications_generate_slug();

-- Optimistic-lock counter + last-editor stamp -- see the `version` column
-- comment above for how the client side of this works.
CREATE OR REPLACE FUNCTION public.ai_applications_bump_version() RETURNS trigger AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_by := public.current_staff_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ai_applications_set_version ON public.ai_applications;
CREATE TRIGGER ai_applications_set_version BEFORE UPDATE ON public.ai_applications
  FOR EACH ROW EXECUTE FUNCTION public.ai_applications_bump_version();

DROP TRIGGER IF EXISTS ai_applications_set_updated_at ON public.ai_applications;
CREATE TRIGGER ai_applications_set_updated_at BEFORE UPDATE ON public.ai_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Every INSERT and every UPDATE (draft-autosave, explicit Save, and status
-- changes like archiving alike) gets a full snapshot -- see the table
-- comment above.
CREATE OR REPLACE FUNCTION public.ai_applications_snapshot_version() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.ai_application_versions
    (application_id, version, title, content_markdown, language, category, status, saved_by)
  VALUES
    (NEW.id, NEW.version, NEW.title, NEW.content_markdown, NEW.language, NEW.category, NEW.status,
     public.current_staff_id());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ai_applications_snapshot ON public.ai_applications;
CREATE TRIGGER ai_applications_snapshot AFTER INSERT OR UPDATE ON public.ai_applications
  FOR EACH ROW EXECUTE FUNCTION public.ai_applications_snapshot_version();

-- Owner-or-admin visibility, matching the citizens/applications RLS
-- pattern -- each function call wrapped in `(SELECT ...)` per the
-- documented perf fix in 08-rls-performance.sql (evaluated once per
-- statement via an InitPlan instead of once per row).
ALTER TABLE public.ai_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_applications_select ON public.ai_applications FOR SELECT TO authenticated
  USING (
    ((SELECT public.is_admin()) OR created_by = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  );

CREATE POLICY ai_applications_insert ON public.ai_applications FOR INSERT TO authenticated
  WITH CHECK (
    -- created_by is actually set by the BEFORE INSERT trigger above, not
    -- trusted from the client body -- this just also rejects anyone
    -- explicitly trying to claim a different owner in the same request.
    (created_by = (SELECT public.current_staff_id()) OR created_by IS NULL)
    AND (SELECT public.aal_satisfied())
  );

CREATE POLICY ai_applications_update ON public.ai_applications FOR UPDATE TO authenticated
  USING (
    ((SELECT public.is_admin()) OR created_by = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  )
  WITH CHECK (
    ((SELECT public.is_admin()) OR created_by = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  );

-- No DELETE policy -- archiving (a status flip via UPDATE) is the only
-- removal path, keeping version history and audit_log meaningful.

ALTER TABLE public.ai_application_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_application_versions_select ON public.ai_application_versions FOR SELECT TO authenticated
  USING (
    (SELECT public.aal_satisfied())
    AND EXISTS (
      SELECT 1 FROM public.ai_applications a
      WHERE a.id = application_id
        AND ((SELECT public.is_admin()) OR a.created_by = (SELECT public.current_staff_id()))
    )
  );

-- No INSERT/UPDATE/DELETE grant to authenticated at all on the versions
-- table -- it's write-once, populated purely by the SECURITY DEFINER
-- trigger above, same shape as audit_log.

DROP TRIGGER IF EXISTS ai_applications_audit ON public.ai_applications;
CREATE TRIGGER ai_applications_audit AFTER INSERT OR UPDATE OR DELETE ON public.ai_applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

GRANT SELECT, INSERT, UPDATE ON public.ai_applications TO authenticated;
GRANT SELECT ON public.ai_application_versions TO authenticated;
