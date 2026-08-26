import type { Session } from "@/lib/auth"
import { listFlaggedApplications } from "@/lib/applicationsApi"
import type { Application } from "@/lib/applicationsApi"

// Only the fields actually present on ApplicationForm.tsx, in the same
// order they appear there -- not every column on the underlying table.
// Several columns (sl_no, gp_ward, june_paid, july_paid,
// beneficiary_status, application_status, district, id, timestamps) exist
// only for the bulk CSV-synced rows this page doesn't manage and were
// deliberately left out, per what this export is meant to cover.
const EXPORT_COLUMNS: { key: keyof Application; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "relative_name", label: "Relative Name (Father/Husband)" },
  { key: "application_number", label: "Application Number" },
  { key: "mobile_number", label: "Mobile Number" },
  { key: "aadhaar_number", label: "Aadhaar Number" },
  { key: "block", label: "Block" },
  { key: "address", label: "Full Address" },
  { key: "voter_number", label: "Voter Number" },
  { key: "application_mode", label: "Application Mode" },
  { key: "remarks", label: "Remarks" },
]

// PostgREST's Range header caps how many rows a single request returns --
// the on-screen table only ever holds one page (20 rows) in state, but an
// export needs every row matching the current filters, so this pages
// through in large batches rather than reusing that state.
const EXPORT_BATCH_SIZE = 1000

async function fetchAllFilteredApplications(
  session: Session,
  filters: { query?: string; flag?: "newly_submitted" | "re_submitted"; date?: string }
): Promise<Application[]> {
  const rows: Application[] = []
  let page = 0
  for (;;) {
    const result = await listFlaggedApplications(session, { ...filters, page, pageSize: EXPORT_BATCH_SIZE })
    rows.push(...result.rows)
    if (rows.length >= result.total || result.rows.length === 0) break
    page++
  }
  return rows
}

function toRows(applications: Application[]): Record<string, string>[] {
  return applications.map((app) =>
    Object.fromEntries(EXPORT_COLUMNS.map(({ key, label }) => [label, app[key] ?? ""]))
  )
}

function escapeCsvCell(value: string): string {
  // Quote whenever the value contains anything that would otherwise break
  // a plain comma-separated read -- comma, quote, or a literal newline
  // (addresses/remarks are free text and can contain either).
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function toCsv(rows: Record<string, string>[]): string {
  const headers = EXPORT_COLUMNS.map((c) => c.label)
  const lines = [headers, ...rows.map((r) => headers.map((h) => String(r[h] ?? "")))]
  // \r\n line endings and a leading UTF-8 BOM -- Excel (the realistic
  // target for a "CSV download" on Windows) mis-detects encoding and
  // garbles non-ASCII text (Bengali names/addresses) without the BOM, and
  // splits rows incorrectly on some locales without \r\n.
  return "\uFEFF" + lines.map((line) => line.map(escapeCsvCell).join(",")).join("\r\n")
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function timestampedFilename(base: string, extension: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `${base}-${stamp}.${extension}`
}

export async function exportApplicationsCsv(
  session: Session,
  filters: { query?: string; flag?: "newly_submitted" | "re_submitted"; date?: string }
): Promise<void> {
  const applications = await fetchAllFilteredApplications(session, filters)
  const csv = toCsv(toRows(applications))
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), timestampedFilename("applications", "csv"))
}

export async function exportApplicationsXlsx(
  session: Session,
  filters: { query?: string; flag?: "newly_submitted" | "re_submitted"; date?: string }
): Promise<void> {
  // xlsx is a meaningful chunk of bundle weight for a rarely-clicked
  // button -- dynamically imported, same pattern pdfDownload.ts already
  // uses for jspdf/html2canvas, so it never loads for anyone who only
  // ever exports CSV (or doesn't export at all).
  const XLSX = await import("xlsx")
  const applications = await fetchAllFilteredApplications(session, filters)
  const rows = toRows(applications)
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS.map((c) => c.label) })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Applications")
  // type: "array" -- keeps this entirely in-memory (no filesystem/Node
  // APIs, which xlsx also supports but don't exist in a browser), then
  // wrapped in a Blob the same way the CSV path already is.
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    timestampedFilename("applications", "xlsx")
  )
}
