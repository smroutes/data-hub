import { Link } from "react-router-dom"
import { ClipboardList } from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/lib/AuthContext"
import { usernameFromSession } from "@/lib/auth"
import { useDocumentTitle } from "@/lib/useDocumentTitle"
import type { Page } from "@/lib/rbacApi"

// "Ongoing work" -- what's currently active for staff to jump into.
// Hardcoded for now (single entry); making this admin-configurable (add/
// remove/reorder from the Admin page) is planned follow-up work, not built
// yet. Each entry links to that work's actual entry-point page -- Annapurna
// Scheme's is Search, not Applications, since that's where staff start
// (new/lookup) before ending up on a specific application.
const ONGOING_WORK: { title: string; description: string; to: string; page: Page }[] = [
  {
    title: "Annapurna Scheme",
    description: "Search, add, and manage Annapurna Scheme applications.",
    to: "/as/search",
    page: "search",
  },
]

export function Home() {
  useDocumentTitle("Home")
  const { session, canVisit } = useAuth()
  const username = session ? usernameFromSession(session) : ""
  const visibleWork = ONGOING_WORK.filter((w) => canVisit(w.page))

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome{username && `, ${username}`} 👋
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Here's what's currently ongoing.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {visibleWork.length === 0 ? (
            <Card>
              <CardHeader>
                <CardDescription>
                  Nothing to show yet -- ask an administrator to grant you access.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            visibleWork.map((w) => (
              <Link key={w.to} to={w.to}>
                <Card className="h-full transition-colors hover:border-brand/50 hover:bg-accent/40">
                  <CardHeader>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                        <ClipboardList className="size-4.5 text-accent-foreground" />
                      </span>
                      <CardTitle className="text-lg">{w.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-1.5">{w.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
