import { LogIn } from "lucide-react"
import { useLocation } from "react-router-dom"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/AuthContext"

// Deliberately non-closeable: no close button, Escape/outside-click/overlay
// clicks are all suppressed. A JWT expiry buried in an inline error message
// under a table is easy to miss -- this forces the re-login instead.
export function SessionExpiredModal() {
  const { expired } = useAuth()
  const location = useLocation()
  // `expired` only clears on a successful sign-in (see AuthContext), but
  // the redirect to /login (ProtectedRoute's <Navigate>, triggered by the
  // same session-expiry handler that sets `expired`) is a client-side SPA
  // navigation, not a fresh page load -- so without this, the modal stayed
  // mounted and open right on top of the login form itself instead of
  // disappearing once the user actually landed there. The login page's own
  // form is enough of a prompt at that point.
  const onLoginPage = location.pathname === "/login"

  return (
    <Dialog open={expired && !onLoginPage}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>
            Your session has expired for security reasons. Please log in again to continue.
          </DialogDescription>
        </DialogHeader>
        <Button onClick={() => window.location.assign("/login")} className="w-full">
          <LogIn className="size-4" />
          Log in again
        </Button>
      </DialogContent>
    </Dialog>
  )
}
