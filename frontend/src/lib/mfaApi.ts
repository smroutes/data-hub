import { API_BASE, mfaChallenge, mfaVerify, saveSession, STORAGE_KEY } from "@/lib/auth"
import type { Session, TokenResponse } from "@/lib/auth"

export interface TotpFactor {
  id: string
  status: "verified" | "unverified"
}

interface GoTrueUser {
  factors?: { id: string; factor_type: string; status: "verified" | "unverified" }[]
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
    return body.error_description || body.msg || body.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

// Whichever storage currently holds a session -- mirrors the choice made
// at login, so a rotated token (enroll-confirm/disable both call GoTrue's
// verify endpoint, which always issues a fresh pair) stays consistent with
// where the original session was persisted.
function currentStorage(): Storage {
  return localStorage.getItem(STORAGE_KEY) ? localStorage : sessionStorage
}

export async function getTotpFactor(session: Session): Promise<TotpFactor | null> {
  const res = await fetch(`${API_BASE}/auth/user`, { headers: headers(session) })
  if (!res.ok) throw new Error(await parseError(res))
  const user = (await res.json()) as GoTrueUser
  const factor = user.factors?.find((f) => f.factor_type === "totp")
  return factor ? { id: factor.id, status: factor.status } : null
}

export async function enrollTotp(
  session: Session
): Promise<{ factorId: string; qrSvg: string; secret: string }> {
  const res = await fetch(`${API_BASE}/auth/factors`, {
    method: "POST",
    headers: headers(session),
    body: JSON.stringify({ factor_type: "totp", friendly_name: "authenticator" }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const body = (await res.json()) as { id: string; totp: { qr_code: string; secret: string } }
  return { factorId: body.id, qrSvg: body.totp.qr_code, secret: body.totp.secret }
}

// Confirms a freshly-enrolled factor. Uses the *current* session's token --
// confirmed against the running stack that this does not require aal2
// (only unenrolling an already-verified factor does). Returns the fresh
// session so the caller can push it into AuthContext.
export async function confirmTotpEnrollment(
  session: Session,
  factorId: string,
  code: string
): Promise<Session> {
  const { challengeId } = await mfaChallenge(session.access_token, factorId)
  const body = await mfaVerify(session.access_token, factorId, challengeId, code)
  return saveSession(body, currentStorage())
}

// Requires a fresh code (step-up to aal2) since GoTrue rejects unenrolling
// an already-verified factor otherwise ("insufficient_aal").
export async function disableTotp(session: Session, factorId: string, code: string): Promise<Session> {
  const { challengeId } = await mfaChallenge(session.access_token, factorId)
  const body: TokenResponse = await mfaVerify(session.access_token, factorId, challengeId, code)
  const stepUpToken = body.access_token

  const res = await fetch(`${API_BASE}/auth/factors/${factorId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${stepUpToken}` },
  })
  if (!res.ok) throw new Error(await parseError(res))

  return saveSession(body, currentStorage())
}
