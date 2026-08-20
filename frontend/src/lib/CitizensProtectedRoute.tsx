import { Navigate } from "react-router-dom"
import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { useCitizensAuth } from "@/lib/CitizensAuthContext"

export function CitizensProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useCitizensAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}
