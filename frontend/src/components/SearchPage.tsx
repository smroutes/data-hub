import { useState } from "react"
import { Search, Loader2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { searchRecords } from "@/lib/api"
import { searchApplications } from "@/lib/applicationsApi"
import { SubmissionFlagBadge } from "@/components/SubmissionFlagBadge"
import { ApplicationFormModal } from "@/components/ApplicationFormModal"
import { useAuth } from "@/lib/AuthContext"
import type { Dataset } from "@/datasets"
import type { Application } from "@/lib/applicationsApi"
import type { SearchResult } from "@/types"

function findNameColumn(columns: string[]) {
  return columns.find((c) => c.toLowerCase().includes("name")) ?? columns[0]
}

// Annapurna Scheme data now lives in Postgres (synced from the CSV, plus
// whatever staff add via "New Application"), so it's searched there instead
// of the DuckDB/parquet path other datasets still use. These are the
// columns worth showing in the results table -- id/timestamps stay hidden.
const ANNAPURNA_COLUMNS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "application_number", label: "Application Number" },
  { key: "mobile_number", label: "Mobile Number" },
  { key: "district", label: "District" },
  { key: "block", label: "Block" },
  { key: "address", label: "Address" },
]

export function SearchPage({ dataset }: { dataset: Dataset }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(dataset.fields.map((f) => [f.param, ""]))
  )
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<SearchResult | null>(null)
  const [noResults, setNoResults] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formTarget, setFormTarget] = useState<Application | null>(null)
  const { session } = useAuth()
  const isAnnapurna = dataset.id === "annapurna"

  async function runSearch() {
    const hasValue = Object.values(values).some((v) => v.trim())
    if (!hasValue) {
      setStatus("Enter at least one search field.")
      setResults([])
      setNoResults(false)
      return
    }
    setLoading(true)
    setStatus("")
    setNoResults(false)
    try {
      const rows =
        isAnnapurna && session
          ? ((await searchApplications(session, values.q ?? "")) as unknown as SearchResult[])
          : await searchRecords(values, dataset.id)
      setResults(rows)
      setStatus(
        rows.length
          ? `${rows.length} result${rows.length === 1 ? "" : "s"} found.`
          : "No results found."
      )
      setNoResults(rows.length === 0)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Search failed.")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const columns = isAnnapurna
    ? ANNAPURNA_COLUMNS.map((c) => c.key)
    : results.length
      ? Object.keys(results[0])
      : []
  const columnLabels = isAnnapurna
    ? Object.fromEntries(ANNAPURNA_COLUMNS.map((c) => [c.key, c.label]))
    : {}
  const nameColumn = isAnnapurna ? "name" : findNameColumn(columns)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{dataset.title}</CardTitle>
            <CardDescription>{dataset.description}</CardDescription>
          </div>

        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            {dataset.fields.map((field) =>
              field.type === "select" ? (
                <Select
                  key={field.param}
                  value={values[field.param]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.param]: e.target.value }))
                  }
                  className="sm:w-40"
                >
                  <option value="">{field.label}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  key={field.param}
                  value={values[field.param]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.param]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder={field.placeholder ?? field.label}
                  autoFocus={field === dataset.fields[0]}
                />
              )
            )}
            <Button onClick={runSearch} disabled={loading} className="sm:w-auto">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Search
            </Button>
          </div>

          {status && (
            <p className="text-muted-foreground mt-3 text-sm">{status}</p>
          )}

          {noResults && dataset.id === "annapurna" && (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <p className="text-base text-foreground">
                No matching record found for this search.
              </p>
              <Button
                onClick={() => {
                  setFormTarget(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" />
                Add New Application
              </Button>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col}>{columnLabels[col] ?? col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) =>
                        col === nameColumn ? (
                          <TableCell key={col}>
                            <button
                              onClick={() => {
                                if (isAnnapurna) {
                                  setFormTarget(row as unknown as Application)
                                  setFormOpen(true)
                                } else {
                                  setSelectedRow(row)
                                }
                              }}
                              className="inline-flex items-center gap-2 text-primary font-medium underline-offset-2 hover:underline"
                            >
                              {row[col] ?? ""}
                              {isAnnapurna && (
                                <SubmissionFlagBadge
                                  flag={row.submission_flag as Application["submission_flag"]}
                                  className="no-underline"
                                />
                              )}
                            </button>
                          </TableCell>
                        ) : (
                          <TableCell key={col}>{row[col] ?? ""}</TableCell>
                        )
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedRow !== null}
        onOpenChange={(open) => !open && setSelectedRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRow?.[nameColumn] ?? "Record details"}</DialogTitle>
            <DialogDescription>{dataset.title}</DialogDescription>
          </DialogHeader>
          <dl className="divide-y">
            {selectedRow &&
              Object.entries(selectedRow).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-2 py-2 text-sm">
                  <dt className="text-muted-foreground col-span-1">{key}</dt>
                  <dd className="col-span-2 break-words">{value ?? "—"}</dd>
                </div>
              ))}
          </dl>
        </DialogContent>
      </Dialog>

      <ApplicationFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        application={formTarget}
        onSaved={() => {
          if (isAnnapurna) runSearch()
        }}
      />
    </div>
  )
}
