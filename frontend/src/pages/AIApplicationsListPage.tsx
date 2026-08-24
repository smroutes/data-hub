import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import {
  Archive,
  ArrowDownUp,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Sparkles,
} from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AiApplicationStatusBadge } from "@/components/AiApplicationStatusBadge"
import { AiApplicationViewModal } from "@/components/AiApplicationViewModal"
import { useAuth } from "@/lib/AuthContext"
import { archiveAiApplication, countAiApplicationsByStatus, listAiApplications } from "@/lib/aiApplicationsApi"
import type { AiApplication, AiApplicationSort } from "@/lib/aiApplicationsApi"
import { useDocumentTitle } from "@/lib/useDocumentTitle"

const LANGUAGE_LABELS: Record<AiApplication["language"], string> = {
  bn: "বাংলা",
  en: "English",
  hi: "हिंदी",
}

const SORT_LABELS: Record<AiApplicationSort, string> = {
  updated_desc: "Latest",
  updated_asc: "Oldest",
  title_asc: "Title (A-Z)",
}

type StatusFilter = "" | "draft" | "saved" | "archived"

const STATUS_LABELS: Record<StatusFilter, string> = {
  "": "All statuses",
  draft: "Draft",
  saved: "Saved",
  archived: "Archived",
}

// Purely decorative color cycle for each row's leading document icon --
// there's no per-application color stored, this just keeps the list from
// looking monotone the same way the design mockup's row icons do.
const ROW_ICON_COLORS = [
  "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
]

function formatRelativeDate(iso: string) {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  if (diffMs < minute) return "Just now"
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hour${diffMs < 2 * hour ? "" : "s"} ago`
  if (diffMs < 2 * day) return "Yesterday"
  if (diffMs < week) return `${Math.floor(diffMs / day)} days ago`
  if (diffMs < 4 * week) return `${Math.floor(diffMs / week)} week${diffMs < 2 * week ? "" : "s"} ago`
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: number
  icon: typeof Sparkles
  className: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${className}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function AIApplicationsListPage() {
  useDocumentTitle("All Applications")
  const { session } = useAuth()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)
  const [applications, setApplications] = useState<AiApplication[]>([])
  const [total, setTotal] = useState(0)
  // Page/rows-per-page live in the URL (?page=2&pageSize=20), not plain
  // component state -- so reloading, sharing a link, or hitting back
  // actually lands back on the same page instead of always resetting to
  // page 1. 1-indexed in the URL (human-facing) but 0-indexed everywhere
  // else in this file to match the existing pagination math below.
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(0, (Number(searchParams.get("page")) || 1) - 1)
  const pageSizeParam = Number(searchParams.get("pageSize"))
  const pageSize = [10, 20, 50].includes(pageSizeParam) ? pageSizeParam : 10

  function setPage(next: number | ((current: number) => number)) {
    setSearchParams(
      (prev) => {
        const value = typeof next === "function" ? next(page) : next
        const params = new URLSearchParams(prev)
        if (value <= 0) params.delete("page")
        else params.set("page", String(value + 1))
        return params
      },
      { replace: true },
    )
  }

  function setRowsPerPage(value: number) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (value === 10) params.delete("pageSize")
        else params.set("pageSize", String(value))
        params.delete("page")
        return params
      },
      { replace: true },
    )
  }

  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("")
  const [sort, setSort] = useState<AiApplicationSort>("updated_desc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState<{ total: number; draft: number; saved: number; archived: number } | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState<AiApplication | null>(null)

  // Matches the ⌘K hint shown in the search box -- Ctrl on non-Mac.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      setPage(0)
      setQuery(search)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  function setStatusFilter(value: StatusFilter) {
    setPage(0)
    setStatus(value)
  }

  function setSortOrder(value: AiApplicationSort) {
    setPage(0)
    setSort(value)
  }

  function refresh() {
    if (!session) return
    setLoading(true)
    listAiApplications(session, { page, pageSize, query, status: status || undefined, sort })
      .then(({ rows, total }) => {
        setApplications(rows)
        setTotal(total)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [session, page, pageSize, query, status, sort])

  useEffect(() => {
    if (!session) return
    countAiApplicationsByStatus(session)
      .then(setStats)
      .catch(() => {
        // Stat cards are a nice-to-have summary -- the table itself still
        // works if this fails, so fail quietly rather than blocking the page.
      })
  }, [session, applications])

  async function handleArchive(app: AiApplication) {
    if (!session) return
    const result = await archiveAiApplication(session, app.id, app.version)
    if ("conflict" in result) {
      toast.error("This application was changed elsewhere. Reload and try again.", { duration: Infinity })
      return
    }
    toast.success("Archived.")
    refresh()
  }

  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const columns: ColumnDef<AiApplication>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const colors = ROW_ICON_COLORS[row.index % ROW_ICON_COLORS.length]
        return (
          <Link to={`/ai-writer/${row.original.slug}`} className="group flex items-center gap-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${colors}`}>
              <FileText className="size-4.5" />
            </span>
            <span className="font-medium text-foreground group-hover:underline">{row.original.title}</span>
          </Link>
        )
      },
    },
    {
      accessorKey: "language",
      header: "Language",
      cell: ({ getValue }) => LANGUAGE_LABELS[getValue() as AiApplication["language"]],
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      accessorKey: "updated_at",
      header: "Last Edited",
      cell: ({ getValue }) => formatRelativeDate(getValue() as string),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <AiApplicationStatusBadge status={getValue() as AiApplication["status"]} />,
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="View"
            onClick={() => {
              setViewTarget(row.original)
              setViewOpen(true)
            }}
          >
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" asChild title="Edit">
            <Link to={`/ai-writer/${row.original.slug}`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" title="More">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/ai-writer/${row.original.slug}`)}>
                <Pencil className="size-3.5" />
                Open
              </DropdownMenuItem>
              {row.original.status !== "archived" && (
                <DropdownMenuItem onSelect={() => handleArchive(row.original)}>
                  <Archive className="size-3.5" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">All Applications</h1>
            <p className="text-muted-foreground">View, search, and manage all your AI generated applications.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link to="/ai-writer">
                <Sparkles className="size-4" />
                New Application
              </Link>
            </Button>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applications..."
                className="pl-8 pr-12"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={
                    status
                      ? "border-brand/40 bg-brand/10 text-brand hover:bg-brand/15 hover:text-brand"
                      : undefined
                  }
                >
                  <Filter className="size-3.5" />
                  {status ? STATUS_LABELS[status] : "Filter"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => (
                  <DropdownMenuItem key={value || "all"} onSelect={() => setStatusFilter(value)}>
                    {STATUS_LABELS[value]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={
                    // updated_desc ("Latest") is the default sort -- only
                    // flag the button as active when something else is
                    // picked, same convention as the status Filter button.
                    sort !== "updated_desc"
                      ? "border-brand/40 bg-brand/10 text-brand hover:bg-brand/15 hover:text-brand"
                      : undefined
                  }
                >
                  <ArrowDownUp className="size-3.5" />
                  Sort: {SORT_LABELS[sort]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_LABELS) as AiApplicationSort[]).map((value) => (
                  <DropdownMenuItem key={value} onSelect={() => setSortOrder(value)}>
                    {SORT_LABELS[value]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Applications"
              value={stats.total}
              icon={Sparkles}
              className="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
            />
            <StatCard
              label="Drafts"
              value={stats.draft}
              icon={ClipboardList}
              className="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
            />
            <StatCard
              label="Saved"
              value={stats.saved}
              icon={Bookmark}
              className="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
            />
            <StatCard
              label="Archived"
              value={stats.archived}
              icon={Archive}
              className="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
            />
          </div>
        )}

        <div>
          {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              !error && (
                <>
                  <DataTable
                    columns={columns}
                    data={applications}
                    emptyMessage={
                      query || status
                        ? "No matching applications."
                        : "No saved applications yet. Generate one from the AI Writer."
                    }
                  />

                  {total > 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>
                        Showing {from} to {to} of {total} applications
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                          >
                            <ChevronLeft className="size-3.5" />
                          </Button>
                          {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
                            <Button
                              key={i}
                              variant={i === page ? "default" : "outline"}
                              size="icon"
                              className="size-8"
                              onClick={() => setPage(i)}
                            >
                              {i + 1}
                            </Button>
                          ))}
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={page >= pageCount - 1}
                            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                          >
                            <ChevronRight className="size-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Rows per page:</span>
                          <Select
                            value={String(pageSize)}
                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            className="w-auto"
                          >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )
            )}
        </div>
      </main>
      <Footer />

      <AiApplicationViewModal open={viewOpen} onOpenChange={setViewOpen} application={viewTarget} />
    </div>
  )
}
