import { API_BASE } from "@/lib/auth"
import type { Session } from "@/lib/auth"
import { signalSessionExpired } from "@/lib/sessionExpiry"

export interface Application {
  id: string
  name: string | null
  application_number: string | null
  mobile_number: string | null
  aadhaar_number: string | null
  district: string | null
  block: string | null
  address: string | null
  voter_number: string | null
  relative_name: string | null
  submission_flag: "newly_submitted" | "re_submitted" | null
  application_mode: "offline" | "online" | "not_applied" | null
  remarks: string | null
  // Populated only for rows synced in from the Annapurna Scheme CSV.
  sl_no: string | null
  gp_ward: string | null
  june_paid: string | null
  july_paid: string | null
  beneficiary_status: string | null
  application_status: string | null
  created_at: string
  updated_at: string
}

// `created_at` is stable from the very first time a row entered the system
// (bulk CSV import, for most rows) -- it's the right date for a
// newly_submitted row, but wrong for a re_submitted one, where the thing
// that actually happened recently is the resubmission itself. Use
// `updated_at` in that case instead.
export function effectiveSubmissionDate(application: Application): string {
  return application.submission_flag === "re_submitted"
    ? application.updated_at
    : application.created_at
}

export type ApplicationInput = Partial<
  Pick<
    Application,
    | "name"
    | "application_number"
    | "mobile_number"
    | "aadhaar_number"
    | "district"
    | "block"
    | "address"
    | "voter_number"
    | "relative_name"
    | "submission_flag"
    | "application_mode"
    | "remarks"
  >
>

async function parseError(res: Response): Promise<string> {
  // 401 here means PostgREST/GoTrue rejected the JWT (expired or otherwise
  // invalid) -- surface this as a blocking re-login prompt instead of an
  // inline error string easy to miss under a table.
  if (res.status === 401) signalSessionExpired()
  try {
    const body = await res.json()
    return body.message || body.hint || body.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

function headers(session: Session, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

// `page` tells the RBAC RLS policies which page-level write permission to
// check (Search and Applications both write this same table but are
// permissioned independently -- see db/postgres/init/05-rbac-schema.sql).
export type ApplicationsPage = "search" | "applications"

export async function createApplication(
  session: Session,
  input: ApplicationInput,
  page: ApplicationsPage
): Promise<Application> {
  const res = await fetch(`${API_BASE}/rest/applications`, {
    method: "POST",
    headers: headers(session, { Prefer: "return=representation", "X-Page": page }),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const [row] = (await res.json()) as Application[]
  return row
}

// Free-text search across the fields that used to be searched in the CSV
// (name, application number, mobile number). Characters that would break
// PostgREST's or=(...) filter syntax are stripped from the query.
export async function searchApplications(session: Session, query: string): Promise<Application[]> {
  const safe = encodeURIComponent(query.replace(/[,()"]/g, "").trim())
  const or = `or=(name.ilike.*${safe}*,application_number.ilike.*${safe}*,mobile_number.ilike.*${safe}*)`
  const res = await fetch(`${API_BASE}/rest/applications?${or}&order=created_at.desc&limit=50`, {
    headers: headers(session),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as Application[]
}

export interface FlaggedApplicationsPage {
  rows: Application[]
  total: number
}

// The IST offset is hardcoded to match the db stack's TZ (see
// db/docker-compose.yml) -- this filters created_at by calendar day in that
// timezone, regardless of the browser's own timezone.
function nextDateString(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

// Newly submitted or re-submitted applications -- the ones staff have
// actually touched, not the bulk CSV-synced rows. Paginated via PostgREST's
// Range header (Prefer: count=exact) so the total is always the real count,
// not capped by a hardcoded limit.
export async function listFlaggedApplications(
  session: Session,
  options: {
    page?: number
    pageSize?: number
    query?: string
    flag?: "newly_submitted" | "re_submitted"
    date?: string
  } = {}
): Promise<FlaggedApplicationsPage> {
  const { page = 0, pageSize = 20, query = "", flag, date } = options
  const from = page * pageSize
  const to = from + pageSize - 1

  const params = new URLSearchParams()
  params.append("submission_flag", flag ? `eq.${flag}` : "not.is.null")
  params.append("order", "updated_at.desc")

  const safe = query.replace(/[,()"]/g, "").trim()
  if (safe) {
    params.append("or", `(name.ilike.*${safe}*,application_number.ilike.*${safe}*,mobile_number.ilike.*${safe}*)`)
  }
  if (date) {
    const start = `${date}T00:00:00+05:30`
    const end = `${nextDateString(date)}T00:00:00+05:30`
    // Match the same "effective submission date" the UI displays and sorts
    // by (see effectiveSubmissionDate below): created_at for newly_submitted
    // rows, updated_at for re_submitted ones -- otherwise filtering by
    // "today" misses everything resubmitted today but created earlier.
    params.append(
      "or",
      `(and(submission_flag.eq.re_submitted,updated_at.gte.${start},updated_at.lt.${end}),and(submission_flag.neq.re_submitted,created_at.gte.${start},created_at.lt.${end}))`
    )
  }

  const res = await fetch(`${API_BASE}/rest/applications?${params.toString()}`, {
    headers: headers(session, { Prefer: "count=exact", Range: `${from}-${to}` }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const rows = (await res.json()) as Application[]
  const contentRange = res.headers.get("Content-Range")
  const total = contentRange ? Number(contentRange.split("/")[1]) : rows.length
  return { rows, total }
}

export async function getApplication(session: Session, id: string): Promise<Application | null> {
  const res = await fetch(`${API_BASE}/rest/applications?id=eq.${id}`, {
    headers: headers(session),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const rows = (await res.json()) as Application[]
  return rows[0] ?? null
}

export async function updateApplication(
  session: Session,
  id: string,
  input: ApplicationInput,
  page: ApplicationsPage
): Promise<Application> {
  const res = await fetch(`${API_BASE}/rest/applications?id=eq.${id}`, {
    method: "PATCH",
    headers: headers(session, { Prefer: "return=representation", "X-Page": page }),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const [row] = (await res.json()) as Application[]
  return row
}
