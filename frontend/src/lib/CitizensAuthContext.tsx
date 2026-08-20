import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import * as auth from "@/lib/citizensAuth"
import type { Session } from "@/lib/citizensAuth"

interface AuthState {
  session: Session | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const CitizensAuthContext = createContext<AuthState | null>(null)

export function CitizensAuthProvider({ children }: { children: ReactNode }) {
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
    <CitizensAuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </CitizensAuthContext.Provider>
  )
}

export function useCitizensAuth(): AuthState {
  const ctx = useContext(CitizensAuthContext)
  if (!ctx) throw new Error("useCitizensAuth must be used within CitizensAuthProvider")
  return ctx
}
