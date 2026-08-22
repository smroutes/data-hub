// Client for the citizen-records stack (../db), a separate app on its own
// droplet. In production this app's own Caddy proxies /auth and /rest
// through to that droplet's gateway, so requests stay same-origin; only
// local dev needs a cross-origin base URL to reach the db droplet directly.
export const API_BASE = import.meta.env.VITE_CITIZENS_API_URL ?? "http://localhost:8081"

export const STORAGE_KEY = "citizen_portal_session"
const EMAIL_DOMAIN = "internal.local"

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number // epoch seconds
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  error?: string
  error_description?: string
  msg?: string
  // Only present on the password-grant response -- used to detect whether
  // this account has TOTP MFA enrolled before deciding whether to persist
  // the session (see login() below).
  user?: { factors?: { id: string; factor_type: string; status: string }[] }
}

export type LoginResult =
  | { mfaRequired: false; session: Session }
  | { mfaRequired: true; factorId: string; pendingAccessToken: string }

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".")
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
  return JSON.parse(json)
}

// The GoTrue user id (JWT `sub` claim) -- used to look up this user's own
// rows in public.staff/public.permissions (see rbacApi.ts).
export function userIdFromSession(session: Session): string {
  const payload = decodeJwtPayload(session.access_token)
  return typeof payload.sub === "string" ? payload.sub : ""
}

export function usernameFromSession(session: Session): string {
  const payload = decodeJwtPayload(session.access_token)
  const email = typeof payload.email === "string" ? payload.email : ""
  return email.endsWith(`@${EMAIL_DOMAIN}`) ? email.slice(0, -(EMAIL_DOMAIN.length + 1)) : email
}

// "Remember me" unchecked -> sessionStorage (cleared when the tab closes).
// Checked (default) -> localStorage (survives browser restarts). Whichever
// one currently holds a session is treated as the source of truth so a
// refresh doesn't silently "upgrade" a session-only login into a persistent
// one.
function currentStorage(): Storage | null {
  if (localStorage.getItem(STORAGE_KEY)) return localStorage
  if (sessionStorage.getItem(STORAGE_KEY)) return sessionStorage
  return null
}

export function loadSession(): Session | null {
  const raw = currentStorage()?.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

// Exported so AuthContext can persist the session that comes back from
// completing an MFA step-up (mfaVerify below), which returns the same
// token-response shape as login()/refresh().
export function saveSession(res: TokenResponse, storage: Storage): Session {
  const session: Session = {
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + res.expires_in,
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}

export function isExpired(session: Session, skewSeconds = 30): boolean {
  return Math.floor(Date.now() / 1000) + skewSeconds >= session.expires_at
}

async function parseAuthError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as TokenResponse
    return body.error_description || body.msg || body.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function login(
  username: string,
  password: string,
  remember = true
): Promise<LoginResult> {
  const email = `${username.trim()}@${EMAIL_DOMAIN}`
  const res = await fetch(`${API_BASE}/auth/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await parseAuthError(res))
  const body = (await res.json()) as TokenResponse

  const totpFactor = body.user?.factors?.find((f) => f.factor_type === "totp" && f.status === "verified")
  if (totpFactor) {
    // Deliberately not calling saveSession -- this token is only aal1, and
    // (as of db/postgres/init/07-mfa-enforcement.sql) useless against every
    // table for an MFA-enrolled account anyway. Never persisted, even
    // transiently, until the TOTP code is verified.
    return { mfaRequired: true, factorId: totpFactor.id, pendingAccessToken: body.access_token }
  }

  return { mfaRequired: false, session: saveSession(body, remember ? localStorage : sessionStorage) }
}

// Login-time step-up (matches the enrollment/disable flow in mfaApi.ts).
export async function mfaChallenge(accessToken: string, factorId: string): Promise<{ challengeId: string }> {
  const res = await fetch(`${API_BASE}/auth/factors/${factorId}/challenge`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  })
  if (!res.ok) throw new Error(await parseAuthError(res))
  const body = (await res.json()) as { id: string }
  return { challengeId: body.id }
}

export async function mfaVerify(
  accessToken: string,
  factorId: string,
  challengeId: string,
  code: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/auth/factors/${factorId}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_id: challengeId, code }),
  })
  if (!res.ok) throw new Error(await parseAuthError(res))
  return (await res.json()) as TokenResponse
}

export async function refresh(session: Session): Promise<Session> {
  const res = await fetch(`${API_BASE}/auth/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (!res.ok) throw new Error(await parseAuthError(res))
  return saveSession((await res.json()) as TokenResponse, currentStorage() ?? localStorage)
}

export async function logout(session: Session | null): Promise<void> {
  if (session) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {})
  }
  clearSession()
}

// Returns a valid (non-expired) session, refreshing it first if needed.
// Clears and returns null if the session is gone or refresh fails.
export async function getValidSession(): Promise<Session | null> {
  const session = loadSession()
  if (!session) return null
  if (!isExpired(session)) return session
  try {
    return await refresh(session)
  } catch {
    clearSession()
    return null
  }
}
