import { useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, FilterX, Loader2, RefreshCw, Search } from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { SubmissionFlagBadge } from "@/components/SubmissionFlagBadge"
import { ApplicationDetailsModal } from "@/components/ApplicationDetailsModal"
import { useAuth } from "@/lib/AuthContext"
import { effectiveSubmissionDate, listFlaggedApplications } from "@/lib/applicationsApi"
import type { Application } from "@/lib/applicationsApi"
import { useDocumentTitle } from "@/lib/useDocumentTitle"

const PAGE_SIZE = 20

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

export function ApplicationsTablePage() {
  useDocumentTitle("Applications")
  const { session } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [flag, setFlag] = useState<"" | "newly_submitted" | "re_submitted">("")
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsTarget, setDetailsTarget] = useState<Application | null>(null)

  // Debounce free-text search -- wait for typing to pause before refetching,
  // and jump back to page 0 since the result set changed.
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(0)
      setQuery(search)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  function setFlagFilter(value: "" | "newly_submitted" | "re_submitted") {
    setPage(0)
    setFlag(value)
  }

  function setDateFilter(value: string) {
    setPage(0)
    setDate(value)
  }

  function clearFilters() {
    setPage(0)
    setSearch("")
    setQuery("")
    setFlag("")
    setDate("")
  }

  function refresh() {
    if (!session) return
    setLoading(true)
    listFlaggedApplications(session, {
      page,
      pageSize: PAGE_SIZE,
      query,
      flag: flag || undefined,
      date: date || undefined,
    })
      .then(({ rows, total }) => {
        setApplications(rows)
        setTotal(total)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [session, page, query, flag, date])

  const hasFilters = Boolean(search || query || flag || date)

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)
  const hasPrev = page > 0
  const hasNext = to < total

  function openDetails(app: Application) {
    setDetailsTarget(app)
    setDetailsOpen(true)
  }

  const columns: ColumnDef<Application>[] = [
    {
      accessorKey: "name",
      header: sortableHeader("Name"),
      cell: ({ row }) => (
        <button
          onClick={() => openDetails(row.original)}
          className="group inline-flex cursor-pointer items-center gap-2 font-medium text-primary"
        >
          <span className="group-hover:underline">{row.original.name || "—"}</span>
          <SubmissionFlagBadge flag={row.original.submission_flag} />
        </button>
      ),
    },
    {
      accessorKey: "application_number",
      header: "Application Number",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      accessorKey: "mobile_number",
      header: "Mobile Number",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      accessorKey: "block",
      header: "Block",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      id: "date",
      accessorFn: (row) => effectiveSubmissionDate(row),
      header: sortableHeader("Date"),
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Applications</CardTitle>
            <CardDescription>
              Annapurna Scheme -- newly submitted and re-submitted applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-start gap-3">
              <div className="max-w-sm flex-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, application number, mobile"
                    className="pl-8"
                  />
                </div>
                {!loading && !error && (
                  <p className="mt-1 pl-0.5 text-sm text-muted-foreground">
                    {total} {total === 1 ? "record" : "records"} found
                  </p>
                )}
              </div>
              <Select
                value={flag}
                onChange={(e) => setFlagFilter(e.target.value as "" | "newly_submitted" | "re_submitted")}
                className="w-auto"
              >
                <option value="">All types</option>
                <option value="newly_submitted">Newly Submitted</option>
                <option value="re_submitted">Re-Submitted</option>
              </Select>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-auto"
              />
              {hasFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  title="Clear all filters and search"
                >
                  <FilterX className="size-3.5" />
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                onClick={refresh}
                disabled={loading}
                title="Reload records"
              >
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
                        : "No newly submitted or re-submitted applications yet."
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

      <ApplicationDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        application={detailsTarget}
      />
    </div>
  )
}
