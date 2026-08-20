import { NavLink } from "react-router-dom"
import { Database, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/AuthContext"
import { usernameFromSession } from "@/lib/auth"
import { cn } from "@/lib/utils"

// Add more entries here as sections come online.
const NAV_ITEMS = [{ to: "/search", label: "Search" }]

export function Header() {
  const { session, signOut } = useAuth()
  const username = session ? usernameFromSession(session) : ""
  const initial = username ? username[0].toUpperCase() : "?"

  return (
    <header className="border-b bg-card">
      <div className="h-1 bg-gradient-to-r from-brand via-orange-400 to-brand" />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2.5 px-4 py-3.5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-orange-600 shadow-sm">
              <Database className="size-4.5 text-white" strokeWidth={2.25} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              DataHub
            </span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
              {initial}
            </span>
            <span className="hidden text-sm font-medium text-foreground sm:inline">
              {username}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
