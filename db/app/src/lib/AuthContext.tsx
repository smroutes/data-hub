import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import * as auth from "@/lib/auth"
import type { Session } from "@/lib/auth"

interface AuthState {
  session: Session | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.getValidSession().then((s) => {
      setSession(s)
      setLoading(false)
    })
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const s = await auth.login(username, password)
    setSession(s)
  }, [])

  const signOut = useCallback(async () => {
    await auth.logout(session)
    setSession(null)
  }, [session])

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
