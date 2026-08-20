import { API_BASE } from "@/lib/auth"
import type { Session } from "@/lib/auth"

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
  >
>

async function parseError(res: Response): Promise<string> {
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

export async function createApplication(
  session: Session,
  input: ApplicationInput
): Promise<Application> {
  const res = await fetch(`${API_BASE}/rest/applications`, {
    method: "POST",
    headers: headers(session, { Prefer: "return=representation" }),
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

export async function listApplications(session: Session): Promise<Application[]> {
  const res = await fetch(`${API_BASE}/rest/applications?order=created_at.desc&limit=100`, {
    headers: headers(session),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as Application[]
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
  input: ApplicationInput
): Promise<Application> {
  const res = await fetch(`${API_BASE}/rest/applications?id=eq.${id}`, {
    method: "PATCH",
    headers: headers(session, { Prefer: "return=representation" }),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const [row] = (await res.json()) as Application[]
  return row
}
