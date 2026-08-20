import { LogOut } from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import { usernameFromSession } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function Dashboard() {
  const { session, signOut } = useAuth()
  const username = session ? usernameFromSession(session) : ""

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <span className="text-lg font-semibold tracking-tight">Citizen Records</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{username}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Signed in</CardTitle>
            <CardDescription>
              You're authenticated as <strong>{username}</strong>. Citizen record
              management screens go here next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a placeholder landing page -- the login/auth flow is wired up
              end-to-end against GoTrue + PostgREST; record CRUD screens are a
              separate follow-up.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
