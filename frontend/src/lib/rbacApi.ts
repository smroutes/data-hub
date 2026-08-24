import { API_BASE, userIdFromSession } from "@/lib/auth"
import type { Session } from "@/lib/auth"

export type Page = "search" | "applications" | "citizens" | "ai_writer"

export interface StaffAccess {
  isAdmin: boolean
  fullName: string | null
  permissions: Record<Page, { read: boolean; write: boolean }>
}

export interface StaffMember {
  id: string
  username: string
  is_admin: boolean
  full_name: string | null
}

export interface PermissionRow {
  user_id: string
  page: Page
  can_read: boolean
  can_write: boolean
}

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  actor_username: string | null
  action: "INSERT" | "UPDATE" | "DELETE"
  table_name: string
  record_id: string | null
  old_data: unknown
  new_data: unknown
  created_at: string
}

function headers(session: Session, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body.message || body.hint || body.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

const EMPTY_PERMISSIONS: StaffAccess["permissions"] = {
  search: { read: false, write: false },
  applications: { read: false, write: false },
  citizens: { read: false, write: false },
  ai_writer: { read: false, write: false },
}

// The caller's own access -- fetched once per session by AuthContext, not
// gated by anything itself (a logged-in user can always read their own
// staff/permissions rows, per the staff_select/permissions_select RLS
// policies in db/postgres/init/05-rbac-schema.sql).
export async function getMyAccess(session: Session): Promise<StaffAccess> {
  const id = userIdFromSession(session)
  const [staffRes, permsRes] = await Promise.all([
    fetch(`${API_BASE}/rest/staff?id=eq.${id}&select=is_admin,full_name`, { headers: headers(session) }),
    fetch(`${API_BASE}/rest/permissions?user_id=eq.${id}&select=page,can_read,can_write`, {
      headers: headers(session),
    }),
  ])
  if (!staffRes.ok) throw new Error(await parseError(staffRes))
  if (!permsRes.ok) throw new Error(await parseError(permsRes))

  const staffRows = (await staffRes.json()) as { is_admin: boolean; full_name: string | null }[]
  const permRows = (await permsRes.json()) as Omit<PermissionRow, "user_id">[]

  const permissions = { ...EMPTY_PERMISSIONS }
  for (const p of permRows) permissions[p.page] = { read: p.can_read, write: p.can_write }

  return {
    isAdmin: staffRows[0]?.is_admin ?? false,
    fullName: staffRows[0]?.full_name ?? null,
    permissions,
  }
}

// Sets the caller's own display name -- see set_my_name() in
// db/postgres/init/06-staff-full-name.sql for why this is an RPC call
// rather than a direct PATCH against public.staff.
export async function setMyName(session: Session, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/rest/rpc/set_my_name`, {
    method: "POST",
    headers: headers(session),
    body: JSON.stringify({ p_name: name }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

// Everything below is for the Admin page -- reads/writes are only actually
// permitted by RLS when the caller is an admin; these calls will fail with
// a PostgREST error for anyone else, same as any other protected endpoint.

export async function listStaff(session: Session): Promise<StaffMember[]> {
  const res = await fetch(`${API_BASE}/rest/staff?select=id,username,is_admin,full_name&order=username.asc`, {
    headers: headers(session),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as StaffMember[]
}

export async function listAllPermissions(session: Session): Promise<PermissionRow[]> {
  const res = await fetch(`${API_BASE}/rest/permissions?select=user_id,page,can_read,can_write`, {
    headers: headers(session),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as PermissionRow[]
}

export async function setAdmin(session: Session, userId: string, isAdmin: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/rest/staff?id=eq.${userId}`, {
    method: "PATCH",
    headers: headers(session),
    body: JSON.stringify({ is_admin: isAdmin }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function upsertPermission(
  session: Session,
  userId: string,
  page: Page,
  perm: { can_read: boolean; can_write: boolean }
): Promise<void> {
  const res = await fetch(`${API_BASE}/rest/permissions?on_conflict=user_id,page`, {
    method: "POST",
    headers: headers(session, { Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ user_id: userId, page, ...perm }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export interface AuditLogPage {
  rows: AuditLogEntry[]
  total: number
}

export async function listAuditLog(
  session: Session,
  options: { page?: number; pageSize?: number } = {}
): Promise<AuditLogPage> {
  const { page = 0, pageSize = 25 } = options
  const from = page * pageSize
  const to = from + pageSize - 1
  const res = await fetch(`${API_BASE}/rest/audit_log?select=*&order=created_at.desc`, {
    headers: headers(session, { Prefer: "count=exact", Range: `${from}-${to}` }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const rows = (await res.json()) as AuditLogEntry[]
  const contentRange = res.headers.get("Content-Range")
  const total = contentRange ? Number(contentRange.split("/")[1]) : rows.length
  return { rows, total }
}
