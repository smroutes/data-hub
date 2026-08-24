import { API_BASE } from "@/lib/auth"
import type { Session } from "@/lib/auth"
import { signalSessionExpired } from "@/lib/sessionExpiry"

export interface AiApplication {
  id: string
  slug: string
  title: string
  prompt: string
  language: "bn" | "en" | "hi"
  category: string | null
  content_markdown: string
  status: "draft" | "saved" | "archived"
  version: number
  suggest_tokens_used: number
  generate_tokens_used: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type AiApplicationInput = Partial<
  Pick<
    AiApplication,
    | "title"
    | "prompt"
    | "language"
    | "category"
    | "content_markdown"
    | "status"
    | "suggest_tokens_used"
    | "generate_tokens_used"
  >
>

// A conflict from updateAiApplication's optimistic-lock check -- the
// version filter matched zero rows because someone else's write already
// bumped it. Not a thrown error: the caller needs to distinguish this from
// a real failure and offer a reload, not just show a generic error toast.
export interface AiApplicationConflict {
  conflict: true
}

async function parseError(res: Response): Promise<string> {
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

export async function createAiApplication(session: Session, input: AiApplicationInput): Promise<AiApplication> {
  const res = await fetch(`${API_BASE}/rest/ai_applications`, {
    method: "POST",
    headers: headers(session, { Prefer: "return=representation" }),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const [row] = (await res.json()) as AiApplication[]
  return row
}

// A missing row is a normal "not found" (bad/stale slug), not an error --
// callers should render a dedicated not-found state, not a toast.
export async function getAiApplicationBySlug(session: Session, slug: string): Promise<AiApplication | null> {
  const res = await fetch(`${API_BASE}/rest/ai_applications?slug=eq.${encodeURIComponent(slug)}`, {
    headers: headers(session),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const rows = (await res.json()) as AiApplication[]
  return rows[0] ?? null
}

export interface AiApplicationsPage {
  rows: AiApplication[]
  total: number
}

export async function listAiApplications(
  session: Session,
  options: {
    page?: number
    pageSize?: number
    query?: string
    status?: "draft" | "saved" | "archived"
  } = {}
): Promise<AiApplicationsPage> {
  const { page = 0, pageSize = 20, query = "", status } = options
  const from = page * pageSize
  const to = from + pageSize - 1

  const params = new URLSearchParams()
  params.append("order", "updated_at.desc")
  if (status) params.append("status", `eq.${status}`)

  // Title-only -- prompt is stored but deliberately never searched/shown
  // in the list UI.
  const safe = query.replace(/[,()"]/g, "").trim()
  if (safe) params.append("title", `ilike.*${safe}*`)

  const res = await fetch(`${API_BASE}/rest/ai_applications?${params.toString()}`, {
    headers: headers(session, { Prefer: "count=exact", Range: `${from}-${to}` }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const rows = (await res.json()) as AiApplication[]
  const contentRange = res.headers.get("Content-Range")
  const total = contentRange ? Number(contentRange.split("/")[1]) : rows.length
  return { rows, total }
}

// One query per status, rather than pulling every row client-side to tally
// -- matters for an admin viewing everyone's documents, where the full set
// isn't necessarily small. `Range: 0-0` + count=exact gets the total
// without fetching more than one row's worth of data.
export async function countAiApplicationsByStatus(
  session: Session
): Promise<{ total: number; draft: number; saved: number; archived: number }> {
  async function count(status?: "draft" | "saved" | "archived"): Promise<number> {
    const params = new URLSearchParams()
    if (status) params.append("status", `eq.${status}`)
    const res = await fetch(`${API_BASE}/rest/ai_applications?${params.toString()}`, {
      headers: headers(session, { Prefer: "count=exact", Range: "0-0" }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    const contentRange = res.headers.get("Content-Range")
    return contentRange ? Number(contentRange.split("/")[1]) : 0
  }
  const [total, draft, saved, archived] = await Promise.all([
    count(), count("draft"), count("saved"), count("archived"),
  ])
  return { total, draft, saved, archived }
}

// Optimistic-lock update: sends the *expected* current version as a query
// filter (server-owned, bumped by a DB trigger -- see
// db/postgres/init/09-ai-applications-schema.sql). If another write
// already bumped it, the filter matches zero rows and PostgREST returns an
// empty array with 200 -- that's the conflict signal itself, there's no
// distinct HTTP status for it.
export async function updateAiApplication(
  session: Session,
  id: string,
  expectedVersion: number,
  input: AiApplicationInput
): Promise<AiApplication | AiApplicationConflict> {
  const res = await fetch(`${API_BASE}/rest/ai_applications?id=eq.${id}&version=eq.${expectedVersion}`, {
    method: "PATCH",
    headers: headers(session, { Prefer: "return=representation" }),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const rows = (await res.json()) as AiApplication[]
  if (rows.length === 0) return { conflict: true }
  return rows[0]
}

export async function archiveAiApplication(
  session: Session,
  id: string,
  expectedVersion: number
): Promise<AiApplication | AiApplicationConflict> {
  return updateAiApplication(session, id, expectedVersion, { status: "archived" })
}
