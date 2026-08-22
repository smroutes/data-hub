import { Link, useLocation } from "react-router-dom"
import { ChevronDown, Database, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "@/components/ui/navigation-menu"
import { useAuth } from "@/lib/AuthContext"
import { usernameFromSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import type { Page } from "@/lib/rbacApi"

// Search and Applications both belong to the Annapurna Scheme work, so
// they're grouped under one nav dropdown instead of two flat top-level
// links -- each sub-item is still individually permission-gated.
const ANNAPURNA_ITEMS: { to: string; label: string; page: Page }[] = [
  { to: "/as/search", label: "Search", page: "search" },
  { to: "/as/applications", label: "Applications", page: "applications" },
]

export function Header() {
  const { session, signOut, canVisit, isAdmin } = useAuth()
  const location = useLocation()
  const username = session ? usernameFromSession(session) : ""
  const initial = username ? username[0].toUpperCase() : "?"
  const annapurnaItems = ANNAPURNA_ITEMS.filter((item) => canVisit(item.page))
  const isAnnapurnaActive = annapurnaItems.some((item) => location.pathname === item.to)

  return (
    <header className="sticky top-0 z-20 border-b bg-card">
      <div className="h-1 bg-gradient-to-r from-brand via-orange-400 to-brand" />
      <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2.5 px-4 py-3.5">
        <div className="flex items-center gap-2.5 justify-self-start">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-orange-600 shadow-sm">
            <Database className="size-4.5 text-white" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            DataHub
          </span>
          <span className="h-8 w-px bg-border" />
          <div className="flex flex-col justify-center">
            <span className="text-xs leading-tight font-medium text-foreground">
              পান্ডবেশ্বর
            </span>
            <span className="text-xs leading-tight font-medium text-foreground">
              বিধানসভা
            </span>
          </div>
        </div>

        <NavigationMenu viewport={false} className="max-w-none justify-self-center">
          <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                active={location.pathname === "/"}
                className={cn(
                  "cursor-pointer rounded-md border border-transparent px-3 py-1.5 font-medium",
                  location.pathname === "/" && "border-border"
                )}
              >
                <Link to="/">Home</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            {annapurnaItems.length > 0 && (
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "cursor-pointer rounded-md border border-transparent px-3 py-1.5 font-medium",
                    isAnnapurnaActive && "border-border"
                  )}
                >
                  Annapurna Scheme
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-44 gap-1 p-1.5">
                    {annapurnaItems.map((item) => {
                      const isActive = location.pathname === item.to
                      return (
                        <li key={item.to}>
                          <NavigationMenuLink
                            asChild
                            active={isActive}
                            className={cn(
                              "cursor-pointer rounded-md border border-transparent px-3 py-1.5 font-medium",
                              isActive && "border-border"
                            )}
                          >
                            <Link to={item.to}>{item.label}</Link>
                          </NavigationMenuLink>
                        </li>
                      )
                    })}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )}

            {isAdmin && (
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  active={location.pathname === "/admin"}
                  className={cn(
                    "cursor-pointer rounded-md border border-transparent px-3 py-1.5 font-medium",
                    location.pathname === "/admin" && "border-border"
                  )}
                >
                  <Link to="/admin">Admin</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="justify-self-end">
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
      </div>
    </header>
  )
}
