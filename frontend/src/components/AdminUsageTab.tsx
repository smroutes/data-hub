import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useAuth } from "@/lib/AuthContext"
import { listUsageEvents } from "@/lib/usageApi"
import type { AiUsageEvent } from "@/lib/usageApi"
import type { StaffMember } from "@/lib/rbacApi"

type RangeKey = "today" | "week" | "month" | "custom"

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom",
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(): Date {
  const d = startOfToday()
  // Monday as the first day of the week.
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d
}

function startOfMonth(): Date {
  const d = startOfToday()
  d.setDate(1)
  return d
}

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

export function AdminUsageTab({ staff }: { staff: StaffMember[] }) {
  const { session } = useAuth()
  const [range, setRange] = useState<RangeKey>("week")
  const [customFrom, setCustomFrom] = useState(() => dateKey(startOfWeek().toISOString()))
  const [customTo, setCustomTo] = useState(() => dateKey(new Date().toISOString()))
  const [events, setEvents] = useState<AiUsageEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const usernameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of staff) map.set(s.id, s.full_name || s.username)
    return map
  }, [staff])

  useEffect(() => {
    if (!session) return
    const since =
      range === "today"
        ? startOfToday()
        : range === "week"
          ? startOfWeek()
          : range === "month"
            ? startOfMonth()
            : new Date(`${customFrom}T00:00:00`)
    // Custom's upper bound is inclusive of the whole end day.
    const until = range === "custom" ? new Date(`${customTo}T23:59:59.999`) : undefined

    setLoading(true)
    setError("")
    listUsageEvents(session, since, until)
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load usage."))
      .finally(() => setLoading(false))
  }, [session, range, customFrom, customTo])

  const totals = useMemo(() => {
    let generateTokens = 0
    let suggestTokens = 0
    let generateCount = 0
    let suggestCount = 0
    for (const e of events) {
      if (e.kind === "generate") {
        generateTokens += e.tokens
        generateCount++
      } else {
        suggestTokens += e.tokens
        suggestCount++
      }
    }
    return { generateTokens, suggestTokens, generateCount, suggestCount, total: generateTokens + suggestTokens }
  }, [events])

  // One row per calendar day in range, so the chart shows genuine zero-days
  // instead of skipping them -- otherwise a quiet Tuesday just vanishes
  // from the x-axis instead of reading as "zero usage that day".
  const chartData = useMemo(() => {
    const byDay = new Map<string, { date: string; generate: number; suggest: number }>()
    for (const e of events) {
      const key = dateKey(e.created_at)
      const row = byDay.get(key) ?? { date: key, generate: 0, suggest: 0 }
      row[e.kind] += e.tokens
      byDay.set(key, row)
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [events])

  const perUser = useMemo(() => {
    const byUser = new Map<
      string,
      { staffId: string; generateTokens: number; suggestTokens: number; events: number }
    >()
    for (const e of events) {
      const row = byUser.get(e.staff_id) ?? { staffId: e.staff_id, generateTokens: 0, suggestTokens: 0, events: 0 }
      if (e.kind === "generate") row.generateTokens += e.tokens
      else row.suggestTokens += e.tokens
      row.events++
      byUser.set(e.staff_id, row)
    }
    return [...byUser.values()].sort(
      (a, b) => b.generateTokens + b.suggestTokens - (a.generateTokens + a.suggestTokens)
    )
  }, [events])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["today", "week", "month", "custom"] as RangeKey[]).map((r) => (
          <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
            {RANGE_LABELS[r]}
          </Button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total tokens" value={totals.total.toLocaleString()} />
            <SummaryCard label="Generations" value={totals.generateCount.toLocaleString()} />
            <SummaryCard label="Suggestions" value={totals.suggestCount.toLocaleString()} />
            <SummaryCard label="Active users" value={String(perUser.length)} />
          </div>

          <div className="h-72 rounded-md border p-4">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No usage in this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="generate" name="Generate tokens" stackId="tokens" fill="var(--brand)" />
                  <Bar dataKey="suggest" name="Suggest tokens" stackId="tokens" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Generate tokens</TableHead>
                  <TableHead className="text-right">Suggest tokens</TableHead>
                  <TableHead className="text-right">Total tokens</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perUser.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No usage in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  perUser.map((row) => (
                    <TableRow key={row.staffId}>
                      <TableCell className="font-medium">{usernameById.get(row.staffId) ?? "—"}</TableCell>
                      <TableCell className="text-right">{row.generateTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.suggestTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">
                        {(row.generateTokens + row.suggestTokens).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.events}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}
