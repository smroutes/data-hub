import { Navigate, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { useAuth } from "@/lib/AuthContext"
import type { Page } from "@/lib/rbacApi"

export function ProtectedRoute({
  children,
  page,
}: {
  children: ReactNode
  // When given, the route also requires page-visibility access (or admin) --
  // omit for pages everyone with a valid session may see (e.g. none today,
  // but kept optional for flexibility).
  page?: Page
}) {
  const { session, loading, accessLoading, canVisit } = useAuth()
  const location = useLocation()

  if (loading || (session && page && accessLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (page && !canVisit(page)) {
    // Include Header (not just the message) -- otherwise a user with no
    // permitted pages has no way to sign out and gets stuck here.
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">You don't have access to this page.</p>
          <p className="text-sm text-muted-foreground">Ask an administrator to grant you access.</p>
        </div>
        <Footer />
      </div>
    )
  }

  return <>{children}</>
}
