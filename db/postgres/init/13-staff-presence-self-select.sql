-- Fixes a real bug: staff_presence's SELECT policy was admin-only, but
-- Postgres also consults a table's SELECT policy (not the UPDATE policy)
-- to determine whether a conflicting row already exists for an
-- `INSERT ... ON CONFLICT DO UPDATE` -- exactly what sendHeartbeat's
-- upsert (usageApi.ts, ?on_conflict=staff_id,device_id) issues on every
-- heartbeat. A non-admin can never pass the admin-only USING clause, so
-- Postgres can't even ask "does a row already exist here?" and rejects
-- the whole upsert with a 42501 row-level-security error -- reproduced
-- directly: a non-admin's heartbeat succeeds as a plain INSERT with no
-- ON CONFLICT clause, but fails the instant ON CONFLICT DO UPDATE is
-- added, even on that user's very first-ever heartbeat with no real
-- conflicting row at all. In practice this silently broke presence
-- tracking for every non-admin account -- only the admin account's own
-- heartbeat (which trivially passes its own admin-only policy) was ever
-- actually recorded.
--
-- Fix: also allow seeing (and thus upsert-conflict-checking) one's own
-- row. Still not a privacy loosening of any consequence -- a non-admin
-- can only ever see their own presence row this way, never anyone
-- else's; admins still see everyone's, unchanged.
DROP POLICY staff_presence_select ON public.staff_presence;
CREATE POLICY staff_presence_select ON public.staff_presence FOR SELECT TO authenticated
  USING (
    ((SELECT public.is_admin()) OR staff_id = (SELECT public.current_staff_id()))
    AND (SELECT public.aal_satisfied())
  );
