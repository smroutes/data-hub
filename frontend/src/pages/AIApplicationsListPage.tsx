import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, FilterX, Loader2, RefreshCw, Search, Sparkles } from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { AiApplicationStatusBadge } from "@/components/AiApplicationStatusBadge"
import { useAuth } from "@/lib/AuthContext"
import { countAiApplicationsByStatus, listAiApplications } from "@/lib/aiApplicationsApi"
import type { AiApplication } from "@/lib/aiApplicationsApi"
import { useDocumentTitle } from "@/lib/useDocumentTitle"

const PAGE_SIZE = 20

const LANGUAGE_LABELS: Record<AiApplication["language"], string> = {
  bn: "বাংলা",
  en: "English",
  hi: "हिंदी",
}

type StatusFilter = "" | "draft" | "saved" | "archived"

function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function sortableHeader(label: string) {
  return function SortableHeader({ column }: { column: { toggleSorting: (asc: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <ArrowUpDown className="size-3.5" />
      </Button>
    )
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

export function AIApplicationsListPage() {
  useDocumentTitle("All Applications")
  const { session } = useAuth()
  const [applications, setApplications] = useState<AiApplication[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [stats, setStats] = useState<{ total: number; draft: number; saved: number; archived: number } | null>(null)

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

  function clearFilters() {
    setPage(0)
    setSearch("")
    setQuery("")
    setStatus("")
  }

  function refresh() {
    if (!session) return
    setLoading(true)
    listAiApplications(session, { page, pageSize: PAGE_SIZE, query, status: status || undefined })
      .then(({ rows, total }) => {
        setApplications(rows)
        setTotal(total)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [session, page, query, status])

  useEffect(() => {
    if (!session) return
    countAiApplicationsByStatus(session)
      .then(setStats)
      .catch(() => {
        // Stat cards are a nice-to-have summary -- the table itself still
        // works if this fails, so fail quietly rather than blocking the page.
      })
  }, [session, applications])

  const hasFilters = Boolean(search || query || status)

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)
  const hasPrev = page > 0
  const hasNext = to < total

  const columns: ColumnDef<AiApplication>[] = [
    {
      accessorKey: "title",
      header: sortableHeader("Title"),
      cell: ({ row }) => (
        <Link
          to={`/ai-writer/${row.original.slug}`}
          className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
        >
          <Sparkles className="size-3.5 shrink-0" />
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      accessorKey: "language",
      header: "Language",
      cell: ({ getValue }) => LANGUAGE_LABELS[getValue() as AiApplication["language"]],
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <AiApplicationStatusBadge status={getValue() as AiApplication["status"]} />,
    },
    {
      accessorKey: "updated_at",
      header: sortableHeader("Updated At"),
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">All Applications</h1>
            <p className="text-muted-foreground">View, search, and manage all your AI generated applications.</p>
          </div>
          <Button asChild>
            <Link to="/ai-writer">
              <Sparkles className="size-4" />
              New Application
            </Link>
          </Button>
        </div>

        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Applications" value={stats.total} />
            <StatCard label="Drafts" value={stats.draft} />
            <StatCard label="Saved" value={stats.saved} />
            <StatCard label="Archived" value={stats.archived} />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Applications</CardTitle>
            <CardDescription>Applications you've generated and saved with the AI Writer.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-start gap-3">
              <div className="max-w-sm flex-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search applications..."
                    className="pl-8"
                  />
                </div>
                {!loading && !error && (
                  <p className="mt-1 pl-0.5 text-sm text-muted-foreground">
                    {total} {total === 1 ? "application" : "applications"} found
                  </p>
                )}
              </div>
              <Select
                value={status}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-auto"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="saved">Saved</option>
                <option value="archived">Archived</option>
              </Select>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters} title="Clear all filters and search">
                  <FilterX className="size-3.5" />
                  Clear
                </Button>
              )}
              <Button variant="outline" onClick={refresh} disabled={loading} title="Reload">
                <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
                Reload
              </Button>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
                      hasFilters
                        ? "No matching applications."
                        : "No saved applications yet -- generate one from the AI Writer."
                    }
                  />

                  {total > 0 && (
                    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        Showing {from}-{to} of {total}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasPrev}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft className="size-3.5" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasNext}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
