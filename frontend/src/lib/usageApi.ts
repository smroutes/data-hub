import { API_BASE } from "@/lib/auth"
import type { Session } from "@/lib/auth"
import { signalSessionExpired } from "@/lib/sessionExpiry"

export interface AiUsageEvent {
  id: string
  staff_id: string
  kind: "generate" | "suggest"
  tokens: number
  application_id: string | null
  created_at: string
}

export interface StaffPresence {
  id: string
  staff_id: string
  device_id: string
  os: string | null
  browser: string | null
  is_active: boolean
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  last_seen_at: string
}

function headers(session: Session, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    ...extra,
  }
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

// Fire-and-forget from the caller's point of view (handleGenerate / the
// suggest-prompt debounce in AIApplicationWriter.tsx) -- a failure here
// must never surface to the user or block the generation they're already
// looking at, so this never throws; callers just don't await it.
export async function recordUsageEvent(
  session: Session,
  event: { kind: "generate" | "suggest"; tokens: number; application_id?: string | null }
): Promise<void> {
  if (event.tokens <= 0) return
  try {
    await fetch(`${API_BASE}/rest/ai_usage_events`, {
      method: "POST",
      headers: headers(session),
      body: JSON.stringify(event),
    })
  } catch {
    // Best-effort -- see function comment.
  }
}

// Same best-effort contract as recordUsageEvent -- called on a timer from
// AuthContext for as long as the app is open, never blocking or surfacing
// errors to the user. Upserts on (staff_id, device_id) -- not staff_id
// alone -- so the same account open on two different computers shows as
// two rows instead of the second overwriting the first.
export async function sendHeartbeat(
  session: Session,
  staffId: string,
  deviceId: string,
  info: { os: string; browser: string; userAgent: string; isActive: boolean },
  geo: { ip: string; city: string | null; region: string | null; country: string | null } | null
): Promise<void> {
  try {
    await fetch(`${API_BASE}/rest/staff_presence?on_conflict=staff_id,device_id`, {
      method: "POST",
      headers: headers(session, { Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({
        staff_id: staffId,
        device_id: deviceId,
        os: info.os,
        browser: info.browser,
        user_agent: info.userAgent,
        is_active: info.isActive,
        ip: geo?.ip ?? null,
        city: geo?.city ?? null,
        region: geo?.region ?? null,
        country: geo?.country ?? null,
      }),
    })
  } catch {
    // Best-effort -- see function comment.
  }
}

// Admin-only (RLS backs this up regardless) -- everything below is for the
// Admin page's Usage tab.

export async function listUsageEvents(session: Session, since: Date, until?: Date): Promise<AiUsageEvent[]> {
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.asc",
  })
  params.append("created_at", `gte.${since.toISOString()}`)
  if (until) params.append("created_at", `lte.${until.toISOString()}`)
  const res = await fetch(`${API_BASE}/rest/ai_usage_events?${params.toString()}`, { headers: headers(session) })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as AiUsageEvent[]
}

// "Online now" -- last_seen_at within the window the caller considers
// active (AdminPage renders this as "N minutes ago" rather than a hard
// on/off, since a heartbeat gap doesn't necessarily mean someone left).
export async function listPresence(session: Session): Promise<StaffPresence[]> {
  const res = await fetch(`${API_BASE}/rest/staff_presence?select=*&order=last_seen_at.desc`, {
    headers: headers(session),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as StaffPresence[]
}
