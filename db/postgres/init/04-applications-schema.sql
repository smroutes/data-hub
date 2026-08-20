-- "New Application" form data (Annapurna Scheme section of the DataHub
-- search app). Separate from `citizens` -- this is staff-entered
-- application intake, not the searchable scheme dataset itself.
-- Name and address are required; every other field is optional.

CREATE TABLE IF NOT EXISTS public.applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text,
  application_number  text,
  mobile_number       text,
  aadhaar_number      text,
  district            text,
  block               text,
  address             text,
  voter_number        text,
  relative_name       text,
  submission_flag     text, -- 'newly_submitted' | 're_submitted' | null
  application_mode    text, -- 'offline' | 'online' | 'not_applied' | null

  -- Populated only for rows synced in from the Annapurna Scheme CSV
  -- (see scripts/import-annapurna.sh); left null for staff-entered rows.
  sl_no               text,
  gp_ward             text,
  june_paid           text,
  july_paid           text,
  beneficiary_status  text,
  application_status  text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT applications_name_required
    CHECK (name IS NOT NULL AND btrim(name) <> ''),
  CONSTRAINT applications_address_required
    CHECK (address IS NOT NULL AND btrim(address) <> ''),

  -- Format checks only apply when a value is actually provided.
  CONSTRAINT applications_mobile_format
    CHECK (mobile_number IS NULL OR mobile_number ~ '^[6-9][0-9]{9}$'),
  CONSTRAINT applications_aadhaar_format
    CHECK (aadhaar_number IS NULL OR aadhaar_number ~ '^[2-9][0-9]{11}$'),
  CONSTRAINT applications_submission_flag_valid
    CHECK (submission_flag IS NULL OR submission_flag IN ('newly_submitted', 're_submitted')),
  CONSTRAINT applications_application_mode_valid
    CHECK (application_mode IS NULL OR application_mode IN ('offline', 'online', 'not_applied'))
);

CREATE INDEX IF NOT EXISTS applications_name_idx        ON public.applications (name);
CREATE INDEX IF NOT EXISTS applications_app_number_idx  ON public.applications (application_number);
CREATE INDEX IF NOT EXISTS applications_mobile_idx      ON public.applications (mobile_number);
CREATE INDEX IF NOT EXISTS applications_aadhaar_idx     ON public.applications (aadhaar_number);

DROP TRIGGER IF EXISTS applications_set_updated_at ON public.applications;
CREATE TRIGGER applications_set_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
