import { LogIn } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/AuthContext"

// Deliberately non-closeable: no close button, Escape/outside-click/overlay
// clicks are all suppressed. A JWT expiry buried in an inline error message
// under a table is easy to miss -- this forces the re-login instead.
export function SessionExpiredModal() {
  const { expired } = useAuth()

  return (
    <Dialog open={expired}>
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
