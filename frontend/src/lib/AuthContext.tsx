import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import * as auth from "@/lib/auth"
import type { Session } from "@/lib/auth"
import { onSessionExpired } from "@/lib/sessionExpiry"

interface AuthState {
  session: Session | null
  loading: boolean
  // True once the session is known to be expired/invalid (a 401 came back
  // from a request, or the periodic check below caught it) -- distinct from
  // signing out, since the UI shows a blocking modal rather than silently
  // dropping to the login page.
  expired: boolean
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

  useEffect(() => {
    auth.getValidSession().then((s) => {
      setSession(s)
      setLoading(false)
    })
  }, [])

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

  return (
    <AuthContext.Provider value={{ session, loading, expired, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
