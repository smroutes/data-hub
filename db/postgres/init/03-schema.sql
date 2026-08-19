-- Application schema for citizen records.
-- Kept intentionally simple -- add columns/tables as needed later with a
-- plain `ALTER TABLE`, no migration framework required at this scale.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS public.citizens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  phone       text,
  address     text,
  village     text,
  ward        text,
  age         smallint,
  gender      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the fields most likely to be searched/filtered on.
-- Deliberately not indexing every column -- 50k rows is small enough that
-- a sequential scan on rarely-filtered columns is fine.
CREATE INDEX IF NOT EXISTS citizens_phone_idx   ON public.citizens (phone);
CREATE INDEX IF NOT EXISTS citizens_village_idx ON public.citizens (village);
CREATE INDEX IF NOT EXISTS citizens_ward_idx    ON public.citizens (ward);
CREATE INDEX IF NOT EXISTS citizens_name_idx    ON public.citizens (name);

-- Keep updated_at current on every row change.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS citizens_set_updated_at ON public.citizens;
CREATE TRIGGER citizens_set_updated_at
  BEFORE UPDATE ON public.citizens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grants: anon gets nothing (this is an internal tool, not a public API).
-- Logged-in staff (the `authenticated` role, from the JWT's role claim)
-- get full CRUD on citizens. No RLS -- every authenticated staff member
-- is trusted with the same access, per the stated requirements.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citizens TO authenticated;
