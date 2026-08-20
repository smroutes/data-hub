import { Header } from "@/components/Header"
import { useAuth } from "@/lib/AuthContext"
import { usernameFromSession } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function CitizensDashboard() {
  const { session } = useAuth()
  const username = session ? usernameFromSession(session) : ""

  return (
    <div className="min-h-svh bg-background">
      <Header />

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
              end-to-end against the citizen-records stack's GoTrue + PostgREST
              gateway; record CRUD screens are a separate follow-up.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
