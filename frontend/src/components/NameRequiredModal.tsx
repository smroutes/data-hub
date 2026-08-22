import { useState } from "react"
import type { FormEvent } from "react"
import { Loader2, User } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import { setMyName } from "@/lib/rbacApi"

// Deliberately non-closeable, same pattern as SessionExpiredModal -- a
// first-time login has no name on file yet, and this blocks the app until
// one is provided instead of leaving staff shown by their bare username
// everywhere.
export function NameRequiredModal() {
  const { needsName, refreshAccess, session } = useAuth()
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session || !name.trim()) {
      setError("Enter your full name.")
      return
    }
    setLoading(true)
    setError("")
    try {
      await setMyName(session, name)
      await refreshAccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={needsName}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Welcome -- what's your name?</DialogTitle>
          <DialogDescription>
            This is your first time signing in. Enter your full name so staff can identify you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
              className="pl-9"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Continue
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
