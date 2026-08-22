import { Link } from "react-router-dom"
import { ChevronDown, Database, LogOut, Menu } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { Page } from "@/lib/rbacApi"

// Search and Applications both belong to the Annapurna Scheme work, so
// they're grouped under one nav dropdown instead of two flat top-level
// links -- each sub-item is still individually permission-gated.
const ANNAPURNA_ITEMS: { to: string; label: string; description: string; page: Page }[] = [
  {
    to: "/as/search",
    label: "Search",
    description: "Look up records and add new applications.",
    page: "search",
  },
  {
    to: "/as/applications",
    label: "Applications",
    description: "Browse newly submitted and re-submitted applications.",
    page: "applications",
  },
]

const NAV_ITEM_CLASS = "cursor-pointer rounded-md px-3 py-1.5 font-medium"

export function Header() {
  const { session, signOut, canVisit, isAdmin } = useAuth()
  const username = session ? usernameFromSession(session) : ""
  const initial = username ? username[0].toUpperCase() : "?"
  const annapurnaItems = ANNAPURNA_ITEMS.filter((item) => canVisit(item.page))

  return (
    <header className="sticky top-0 z-20 border-b bg-card">
      <div className="h-1 bg-gradient-to-r from-brand via-orange-400 to-brand" />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2.5 px-4 py-3.5 md:grid md:grid-cols-[1fr_auto_1fr]">
        <div className="flex items-center gap-2.5 justify-self-start">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-orange-600 shadow-sm">
            <Database className="size-4.5 text-white" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            DataHub
          </span>
          {/* Bengali subtitle takes real width and isn't essential once the
              header has to compete with nav + account controls on a phone. */}
          <span className="hidden h-8 w-px bg-border sm:block" />
          <div className="hidden flex-col justify-center sm:flex">
            <span className="text-xs leading-tight font-medium text-foreground">
              পান্ডবেশ্বর
            </span>
            <span className="text-xs leading-tight font-medium text-foreground">
              বিধানসভা
            </span>
          </div>
        </div>

        <NavigationMenu className="hidden max-w-none md:flex md:justify-self-center">
          <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={NAV_ITEM_CLASS}>
                <Link to="/">Home</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            {annapurnaItems.length > 0 && (
              <NavigationMenuItem>
                <NavigationMenuTrigger className={NAV_ITEM_CLASS}>Annapurna Scheme</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-64 gap-0.5 p-1">
                    {annapurnaItems.map((item) => (
                      <li key={item.to}>
                        <NavigationMenuLink asChild className="px-2 py-1.5">
                          <Link to={item.to}>
                            <div className="font-medium">{item.label}</div>
                            <p className="text-muted-foreground">{item.description}</p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )}

            {isAdmin && (
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={NAV_ITEM_CLASS}>
                  <Link to="/admin">Admin</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden justify-self-end md:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex cursor-pointer items-center gap-2 rounded-md py-1 pr-1 pl-1.5 transition-colors hover:bg-accent">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                  {initial}
                </span>
                <span className="text-sm font-medium text-foreground">{username}</span>
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

        {/* Below md, the horizontal nav + account button don't fit -- fold
            everything (pages, admin, sign out) into one menu instead. */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent"
                aria-label="Open menu"
              >
                <Menu className="size-5 text-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                  {initial}
                </span>
                <span className="text-sm font-medium text-foreground">{username}</span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/">Home</Link>
              </DropdownMenuItem>
              {annapurnaItems.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">Admin</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
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
