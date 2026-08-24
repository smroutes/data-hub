import { useEffect, useMemo, useState } from "react"
import { Loader2, Circle } from "lucide-react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useAuth } from "@/lib/AuthContext"
import { listPresence } from "@/lib/usageApi"
import type { StaffPresence } from "@/lib/usageApi"
import type { StaffMember } from "@/lib/rbacApi"

// Matches the heartbeat cadence in AuthContext (60s) plus enough slack for
// a couple of missed beats before treating someone as gone, rather than a
// hair-trigger flip the moment a single beat is late.
const ONLINE_WINDOW_MS = 3 * 60_000
const REFRESH_INTERVAL_MS = 30_000

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function locationLabel(p: StaffPresence): string {
  const parts = [p.city, p.region, p.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "—"
}

function deviceLabel(p: StaffPresence): string {
  if (p.browser && p.os) return `${p.browser} on ${p.os}`
  return p.browser || p.os || "Unknown device"
}

export function AdminPresenceTab({ staff }: { staff: StaffMember[] }) {
  const { session } = useAuth()
  const [rows, setRows] = useState<StaffPresence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const usernameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of staff) map.set(s.id, s.full_name || s.username)
    return map
  }, [staff])

  useEffect(() => {
    if (!session) return
    function load() {
      if (!session) return
      listPresence(session)
        .then(setRows)
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load presence."))
        .finally(() => setLoading(false))
    }
    load()
    const id = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [session])

  const onlineCount = rows.filter((r) => Date.now() - new Date(r.last_seen_at).getTime() < ONLINE_WINDOW_MS).length

  return (
    <div className="flex flex-col gap-4">
      {/* Presence is a periodic heartbeat (last-seen + last-known IP), not
          a real login/logout session log -- JWT auth here is stateless, so
          this is the closest honest approximation of "who's around right
          now" rather than a true session history. One row per device, not
          per account -- the same login shared across multiple computers
          shows up as separate rows instead of one overwriting another. */}
      <p className="text-sm text-muted-foreground">
        Based on a periodic heartbeat while the app is open, not a login/logout log -- one row per device (the same
        account can be open on several at once). "Online" means a heartbeat within the last{" "}
        {ONLINE_WINDOW_MS / 60_000} minutes; "Active" means the tab was visible and actually being used, not just
        left open.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="w-fit rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Online now</div>
            <div className="text-2xl font-semibold">{onlineCount}</div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No presence data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const online = Date.now() - new Date(row.last_seen_at).getTime() < ONLINE_WINDOW_MS
                    const statusLabel = online ? (row.is_active ? "Active" : "Idle") : "Offline"
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{usernameById.get(row.staff_id) ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{deviceLabel(row)}</TableCell>
                        <TableCell>
                          <span
                            className={`flex items-center gap-1.5 text-sm ${
                              online
                                ? row.is_active
                                  ? "text-green-600 dark:text-green-500"
                                  : "text-amber-600 dark:text-amber-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            <Circle className={`size-2 ${online ? "fill-current" : "fill-current opacity-40"}`} />
                            {statusLabel}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{relativeTime(row.last_seen_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{row.ip || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{locationLabel(row)}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
