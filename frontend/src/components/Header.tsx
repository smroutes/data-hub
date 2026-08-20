import { ChevronDown, Database, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/AuthContext"
import { usernameFromSession } from "@/lib/auth"
import type { Dataset } from "@/datasets"

export function Header({
  datasets,
  selected,
  onSelect,
}: {
  datasets: Dataset[]
  selected: Dataset
  onSelect: (id: string) => void
}) {
  const { session, signOut } = useAuth()
  const username = session ? usernameFromSession(session) : ""

  return (
    <header className="border-b bg-card">
      <div className="h-1 bg-gradient-to-r from-brand via-orange-400 to-brand" />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2.5 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-orange-600 shadow-sm">
            <Database className="size-4.5 text-white" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            DataHub
          </span>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-[40vw] gap-1.5 sm:max-w-none">
                <span className="truncate">{selected.title}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {datasets.map((d) => (
                <DropdownMenuItem
                  key={d.id}
                  disabled={!d.available}
                  onSelect={() => onSelect(d.id)}
                >
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">{d.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {d.available ? d.description : "Coming soon"}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="hidden text-sm text-muted-foreground sm:inline">{username}</span>
          <Button variant="outline" size="icon" onClick={() => signOut()} aria-label="Sign out">
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
