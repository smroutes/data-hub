import { NavLink } from "react-router-dom"
import { ChevronDown, Database, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex cursor-pointer items-center gap-2 rounded-md py-1 pr-1 pl-1.5 transition-colors hover:bg-accent">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                {initial}
              </span>
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {username}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => signOut()}>
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
