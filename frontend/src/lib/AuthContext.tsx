import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import * as auth from "@/lib/auth"
import type { Session } from "@/lib/auth"
import { onSessionExpired } from "@/lib/sessionExpiry"
import { getMyAccess } from "@/lib/rbacApi"
import type { Page, StaffAccess } from "@/lib/rbacApi"

interface AuthState {
  session: Session | null
  loading: boolean
  // True once the session is known to be expired/invalid (a 401 came back
  // from a request, or the periodic check below caught it) -- distinct from
  // signing out, since the UI shows a blocking modal rather than silently
  // dropping to the login page.
  expired: boolean
  access: StaffAccess | null
  accessLoading: boolean
  isAdmin: boolean
  // access.fullName when set, falling back to the username derived from
  // the JWT -- everywhere in the UI that shows "who is this" should read
  // this instead of calling usernameFromSession directly.
  displayName: string
  // True once a session and access are both confirmed loaded and no name
  // is on file yet -- gates the non-closeable NameRequiredModal.
  needsName: boolean
  canVisit: (page: Page) => boolean
  can: (page: Page, op: "read" | "write") => boolean
  refreshAccess: () => Promise<void>
  signIn: (username: string, password: string, remember?: boolean) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// How often to proactively check the current session while the app sits
// open and idle -- so expiry is caught even if the user isn't actively
// triggering requests that would otherwise surface a 401.
const EXPIRY_CHECK_INTERVAL_MS = 30_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [access, setAccess] = useState<StaffAccess | null>(null)
  // Starts true (not false) -- a session can be set synchronously with
  // `loading` turning false (see getValidSession() below), one render
  // before the access-fetch effect has even run. If this started false,
  // ProtectedRoute would see accessLoading=false + access=null for that
  // one frame and briefly render "access denied" before the real answer
  // arrives.
  const [accessLoading, setAccessLoading] = useState(true)

  useEffect(() => {
    auth.getValidSession().then((s) => {
      setSession(s)
      setLoading(false)
    })
  }, [])

  // Keyed on the user id (stable across token refreshes), not the session
  // object itself, so a routine access-token refresh doesn't re-trigger a
  // permissions fetch.
  const userId = session ? auth.userIdFromSession(session) : ""
  useEffect(() => {
    if (!session) {
      setAccess(null)
      setAccessLoading(false)
      return
    }
    setAccessLoading(true)
    getMyAccess(session)
      .then(setAccess)
      .catch(() => setAccess(null))
      .finally(() => setAccessLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const refreshAccess = useCallback(async () => {
    if (!session) return
    setAccess(await getMyAccess(session))
  }, [session])

  // Reactive: a request came back 401 (expired/invalid JWT).
  useEffect(() => {
    return onSessionExpired(() => {
      auth.clearSession()
      setSession(null)
      setExpired(true)
    })
  }, [])

  // Proactive: catch idle expiry even with no in-flight requests.
  useEffect(() => {
    const id = setInterval(() => {
      setSession((current) => {
        if (!current || !auth.isExpired(current)) return current
        auth
          .refresh(current)
          .then(setSession)
          .catch(() => {
            auth.clearSession()
            setSession(null)
            setExpired(true)
          })
        return current
      })
    }, EXPIRY_CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const signIn = useCallback(async (username: string, password: string, remember = true) => {
    const s = await auth.login(username, password, remember)
    setSession(s)
    setExpired(false)
  }, [])

  const signOut = useCallback(async () => {
    await auth.logout(session)
    setSession(null)
    setExpired(false)
  }, [session])

  const isAdmin = access?.isAdmin ?? false
  const displayName = access?.fullName || (session ? auth.usernameFromSession(session) : "")
  const needsName = Boolean(session && !accessLoading && access && !access.fullName)

  // Fails closed while access is still loading or unknown -- a page/action
  // only becomes available once permissions have actually been confirmed.
  const canVisit = useCallback(
    (page: Page) => isAdmin || Boolean(access?.permissions[page]?.read || access?.permissions[page]?.write),
    [isAdmin, access]
  )
  const can = useCallback(
    (page: Page, op: "read" | "write") => isAdmin || Boolean(access?.permissions[page]?.[op]),
    [isAdmin, access]
  )

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        expired,
        access,
        accessLoading,
        isAdmin,
        displayName,
        needsName,
        canVisit,
        can,
        refreshAccess,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
