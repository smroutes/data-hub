-- Two independent additions for the admin "Usage" dashboard:
--
-- 1. ai_usage_events -- a per-call token-spend log. ai_applications only
--    ever stores a running CUMULATIVE total per document (overwritten on
--    every regenerate), so there's no way to answer "how many tokens were
--    spent today/this week" from it -- that needs one timestamped row per
--    actual generate/suggest call. Written by the frontend right after
--    each successful call (same place persistAfterGenerate already runs).
--
-- 2. staff_presence -- a periodic heartbeat, not a real session log. JWT
--    auth here is stateless (GoTrue + PostgREST, no server-side session
--    table), so "who is currently logged in" can only ever be approximated
--    as "whose browser pinged us in the last few minutes, and from what IP
--    it last reported" -- one row per (staff, device), upserted on
--    heartbeat, not a history of logins/logouts. Multiple staff sharing
--    one login account from different computers is the normal case here,
--    so this is keyed on a random per-browser device_id (generated once,
--    stored in localStorage), not staff_id alone -- otherwise a second
--    device's heartbeat would just silently overwrite the first's row.
--    No browser exposes the OS-level machine name to a webpage (a
--    deliberate anti-fingerprinting restriction in every major browser,
--    not something a client-side script can work around) -- os/browser
--    are parsed from the User-Agent string instead, the closest real
--    substitute available without installing something outside the
--    browser on each machine.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('generate', 'suggest')),
  tokens          integer NOT NULL CHECK (tokens >= 0),
  application_id  uuid REFERENCES public.ai_applications(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_created_at_idx ON public.ai_usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_staff_id_idx ON public.ai_usage_events (staff_id);

-- The frontend never sends staff_id itself (same reasoning as
-- ai_applications' created_by -- never trust a client-supplied owner);
-- this fills it in from the caller's JWT.
CREATE OR REPLACE FUNCTION public.ai_usage_events_set_staff_id() RETURNS trigger AS $$
BEGIN
  IF NEW.staff_id IS NULL THEN
    NEW.staff_id := public.current_staff_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ai_usage_events_set_staff_id ON public.ai_usage_events;
CREATE TRIGGER ai_usage_events_set_staff_id
  BEFORE INSERT ON public.ai_usage_events
  FOR EACH ROW EXECUTE FUNCTION public.ai_usage_events_set_staff_id();

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Analytics are admin-only (the point of this table is the admin usage
-- dashboard) -- a regular staff member's own AI Writer access is already
-- governed by ai_applications' own RLS, this table doesn't need to be
-- independently readable by them too.
CREATE POLICY ai_usage_events_select ON public.ai_usage_events FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) AND (SELECT public.aal_satisfied()));

-- Any staff member with AI Writer write access can log their own events --
-- this fires as a side effect of a generate/suggest call already gated by
-- ai_applications_insert/update's has_permission('ai_writer', 'write').
-- `OR staff_id IS NULL` mirrors ai_applications_insert's identical
-- defensive allowance -- WITH CHECK evaluates NEW after the BEFORE
-- trigger above has already filled staff_id in, so in practice this
-- branch never actually fires, but it costs nothing and matches the
-- established pattern.
CREATE POLICY ai_usage_events_insert ON public.ai_usage_events FOR INSERT TO authenticated
  WITH CHECK (
    (staff_id = (SELECT public.current_staff_id()) OR staff_id IS NULL)
    AND (SELECT public.has_permission('ai_writer', 'write'))
    AND (SELECT public.aal_satisfied())
  );

GRANT SELECT, INSERT ON public.ai_usage_events TO authenticated;

CREATE TABLE IF NOT EXISTS public.staff_presence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  device_id     text NOT NULL,
  os            text,
  browser       text,
  user_agent    text,
  -- Whether the tab was visible/interacted-with recently as of the last
  -- heartbeat, not whether the account is "logged in" -- a browser left
  -- open on an unattended desk still heartbeats (the JS timer keeps
  -- running), but flips to idle once the tab loses focus or nothing's
  -- been clicked/typed/scrolled for a while. See AuthContext's activity
  -- tracking for the actual idle threshold.
  is_active     boolean NOT NULL DEFAULT true,
  ip            text,
  city          text,
  region        text,
  country       text,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, device_id)
);

CREATE INDEX IF NOT EXISTS staff_presence_staff_id_idx ON public.staff_presence (staff_id);

-- Never trust a client-supplied timestamp for "when was this" -- same
-- reasoning as the version-bump trigger on ai_applications. A heartbeat
-- claiming to be from the future (or stale-but-replayed) would otherwise
-- be indistinguishable from a real one.
CREATE OR REPLACE FUNCTION public.staff_presence_set_last_seen() RETURNS trigger AS $$
BEGIN
  NEW.last_seen_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS staff_presence_set_last_seen ON public.staff_presence;
CREATE TRIGGER staff_presence_set_last_seen
  BEFORE INSERT OR UPDATE ON public.staff_presence
  FOR EACH ROW EXECUTE FUNCTION public.staff_presence_set_last_seen();

ALTER TABLE public.staff_presence ENABLE ROW LEVEL SECURITY;

-- Admin, or one's own row -- not just admin. Postgres also consults a
-- table's SELECT policy (not the UPDATE policy) to determine whether a
-- conflicting row already exists for an `INSERT ... ON CONFLICT DO
-- UPDATE`, which is exactly what sendHeartbeat's upsert issues on every
-- heartbeat (usageApi.ts, ?on_conflict=staff_id,device_id) -- an
-- admin-only USING clause here would silently break every non-admin's
-- heartbeat (reproduced directly: fails only with ON CONFLICT DO UPDATE
-- present, even on that user's very first-ever heartbeat with no real
-- conflicting row). Harmless to allow: a non-admin can only ever see
-- their own row this way, never anyone else's.
CREATE POLICY staff_presence_select ON public.staff_presence FOR SELECT TO authenticated
  USING (
    ((SELECT public.is_admin()) OR staff_id = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  );

CREATE POLICY staff_presence_upsert ON public.staff_presence FOR INSERT TO authenticated
  WITH CHECK (staff_id = (SELECT public.current_staff_id()) AND (SELECT public.aal_satisfied()));

CREATE POLICY staff_presence_update ON public.staff_presence FOR UPDATE TO authenticated
  USING (staff_id = (SELECT public.current_staff_id()) AND (SELECT public.aal_satisfied()))
  WITH CHECK (staff_id = (SELECT public.current_staff_id()) AND (SELECT public.aal_satisfied()));

GRANT SELECT, INSERT, UPDATE ON public.staff_presence TO authenticated;
