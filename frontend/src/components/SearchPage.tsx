import { useState } from "react"
import { Search, Loader2, ChevronDown } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
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
import type { Dataset } from "@/datasets"
import type { SearchResult } from "@/types"

function findNameColumn(columns: string[]) {
  return columns.find((c) => c.toLowerCase().includes("name")) ?? columns[0]
}

export function SearchPage({
  dataset,
  datasets,
  onSelectDataset,
}: {
  dataset: Dataset
  datasets: Dataset[]
  onSelectDataset: (id: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(dataset.fields.map((f) => [f.param, ""]))
  )
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<SearchResult | null>(null)

  async function runSearch() {
    const hasValue = Object.values(values).some((v) => v.trim())
    if (!hasValue) {
      setStatus("Enter at least one search field.")
      setResults([])
      return
    }
    setLoading(true)
    setStatus("")
    try {
      const rows = await searchRecords(values, dataset.id)
      setResults(rows)
      setStatus(
        rows.length
          ? `${rows.length} result${rows.length === 1 ? "" : "s"} found.`
          : "No results found."
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Search failed.")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const columns = results.length ? Object.keys(results[0]) : []
  const nameColumn = findNameColumn(columns)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{dataset.title}</CardTitle>
            <CardDescription>{dataset.description}</CardDescription>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-[40vw] shrink-0 gap-1.5 sm:max-w-none">
                <span className="truncate">{dataset.title}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {datasets.map((d) => (
                <DropdownMenuItem
                  key={d.id}
                  disabled={!d.available}
                  onSelect={() => onSelectDataset(d.id)}
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

          {results.length > 0 && (
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
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
                              onClick={() => setSelectedRow(row)}
                              className="text-primary font-medium underline-offset-2 hover:underline"
                            >
                              {row[col] ?? ""}
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
    </div>
  )
}
