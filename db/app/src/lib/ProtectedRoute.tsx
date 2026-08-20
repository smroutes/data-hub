import { Navigate } from "react-router-dom"
import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/AuthContext"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

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
