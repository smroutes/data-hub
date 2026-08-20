const STORAGE_KEY = "citizen_portal_session"
const EMAIL_DOMAIN = "internal.local"

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number // epoch seconds
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  error?: string
  error_description?: string
  msg?: string
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".")
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
  return JSON.parse(json)
}

export function usernameFromSession(session: Session): string {
  const payload = decodeJwtPayload(session.access_token)
  const email = typeof payload.email === "string" ? payload.email : ""
  return email.endsWith(`@${EMAIL_DOMAIN}`) ? email.slice(0, -(EMAIL_DOMAIN.length + 1)) : email
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

function saveSession(res: TokenResponse): Session {
  const session: Session = {
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + res.expires_in,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
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

export async function login(username: string, password: string): Promise<Session> {
  const email = `${username.trim()}@${EMAIL_DOMAIN}`
  const res = await fetch("/auth/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await parseAuthError(res))
  return saveSession((await res.json()) as TokenResponse)
}

export async function refresh(session: Session): Promise<Session> {
  const res = await fetch("/auth/token?grant_type=refresh_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (!res.ok) throw new Error(await parseAuthError(res))
  return saveSession((await res.json()) as TokenResponse)
}

export async function logout(session: Session | null): Promise<void> {
  if (session) {
    await fetch("/auth/logout", {
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
