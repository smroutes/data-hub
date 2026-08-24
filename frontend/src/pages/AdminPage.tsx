import { Fragment, useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Loader2, ShieldAlert } from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { DataTable } from "@/components/ui/data-table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/AuthContext"
import { useDocumentTitle } from "@/lib/useDocumentTitle"
import {
  listStaff,
  listAllPermissions,
  setAdmin,
  upsertPermission,
  listAuditLog,
} from "@/lib/rbacApi"
import type { StaffMember, Page as RbacPage, AuditLogEntry } from "@/lib/rbacApi"

const PAGES: RbacPage[] = ["search", "applications", "citizens", "ai_writer"]
const PAGE_LABELS: Record<RbacPage, string> = {
  search: "Search",
  applications: "Applications",
  citizens: "Citizens",
  ai_writer: "AI Writer",
}
const AUDIT_PAGE_SIZE = 25

type PermEntry = { read: boolean; write: boolean }
type PermMap = Record<string, Record<RbacPage, PermEntry>>

function emptyPerm(): Record<RbacPage, PermEntry> {
  return {
    search: { read: false, write: false },
    applications: { read: false, write: false },
    citizens: { read: false, write: false },
    ai_writer: { read: false, write: false },
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}

export function AdminPage() {
  useDocumentTitle("Admin")
  const { session, isAdmin, accessLoading } = useAuth()
  const [tab, setTab] = useState<"users" | "activity">("users")
  const [error, setError] = useState("")

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [perms, setPerms] = useState<PermMap>({})
  const [loadingStaff, setLoadingStaff] = useState(true)

  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(0)
  const [auditLoading, setAuditLoading] = useState(false)

  function loadStaff() {
    if (!session) return
    setLoadingStaff(true)
    Promise.all([listStaff(session), listAllPermissions(session)])
      .then(([staffRows, permRows]) => {
        setStaff(staffRows)
        const map: PermMap = {}
        for (const s of staffRows) map[s.id] = emptyPerm()
        for (const p of permRows) {
          if (!map[p.user_id]) map[p.user_id] = emptyPerm()
          map[p.user_id][p.page] = { read: p.can_read, write: p.can_write }
        }
        setPerms(map)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load staff."))
      .finally(() => setLoadingStaff(false))
  }

  useEffect(() => {
    if (isAdmin) loadStaff()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isAdmin])

  useEffect(() => {
    if (!isAdmin || tab !== "activity" || !session) return
    setAuditLoading(true)
    listAuditLog(session, { page: auditPage, pageSize: AUDIT_PAGE_SIZE })
      .then(({ rows, total }) => {
        setAuditRows(rows)
        setAuditTotal(total)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load activity."))
      .finally(() => setAuditLoading(false))
  }, [session, isAdmin, tab, auditPage])

  async function handleToggleAdmin(member: StaffMember) {
    if (!session) return
    const nextValue = !member.is_admin
    setStaff((rows) => rows.map((r) => (r.id === member.id ? { ...r, is_admin: nextValue } : r)))
    try {
      await setAdmin(session, member.id, nextValue)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update admin status.")
      loadStaff()
    }
  }

  async function handleTogglePermission(userId: string, page: RbacPage, field: keyof PermEntry) {
    if (!session) return
    const current = perms[userId]?.[page] ?? { read: false, write: false }
    const next = { ...current, [field]: !current[field] }
    setPerms((m) => ({ ...m, [userId]: { ...(m[userId] ?? emptyPerm()), [page]: next } }))
    try {
      await upsertPermission(session, userId, page, { can_read: next.read, can_write: next.write })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update permission.")
      loadStaff()
    }
  }

  if (accessLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">Admins only.</p>
        </div>
        <Footer />
      </div>
    )
  }

  const auditColumns: ColumnDef<AuditLogEntry>[] = [
    {
      accessorKey: "created_at",
      header: "When",
      cell: ({ getValue }) => formatDateTime(getValue() as string),
    },
    {
      accessorKey: "actor_username",
      header: "Who",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "table_name", header: "Table" },
    {
      accessorKey: "record_id",
      header: "Record",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{((getValue() as string) || "").slice(0, 8)}</span>
      ),
    },
  ]

  const from = auditTotal === 0 ? 0 : auditPage * AUDIT_PAGE_SIZE + 1
  const to = Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, auditTotal)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Admin</CardTitle>
            <CardDescription>Manage staff access and review activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "users" | "activity")}>
              <TabsList className="mb-4">
                <TabsTrigger value="users">Users &amp; Permissions</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <TabsContent value="users">
                {loadingStaff ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead rowSpan={2} className="align-bottom">
                            Name
                          </TableHead>
                          <TableHead rowSpan={2} className="align-bottom">
                            Username
                          </TableHead>
                          <TableHead rowSpan={2} className="text-center align-bottom">
                            Admin
                          </TableHead>
                          {PAGES.map((p) => (
                            <TableHead key={p} colSpan={2} className="border-l text-center">
                              {PAGE_LABELS[p]}
                            </TableHead>
                          ))}
                        </TableRow>
                        <TableRow>
                          {PAGES.map((p) => (
                            <Fragment key={p}>
                              <TableHead className="border-l text-center text-xs">Read</TableHead>
                              <TableHead className="text-center text-xs">Write</TableHead>
                            </Fragment>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staff.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">{member.full_name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{member.username}</TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={member.is_admin}
                                onCheckedChange={() => handleToggleAdmin(member)}
                                aria-label="Admin (full access)"
                              />
                            </TableCell>
                            {PAGES.map((p) => (
                              <Fragment key={p}>
                                <TableCell className="border-l text-center">
                                  <Checkbox
                                    disabled={member.is_admin}
                                    checked={member.is_admin || Boolean(perms[member.id]?.[p]?.read)}
                                    onCheckedChange={() => handleTogglePermission(member.id, p, "read")}
                                    aria-label={`${PAGE_LABELS[p]} read`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    disabled={member.is_admin}
                                    checked={member.is_admin || Boolean(perms[member.id]?.[p]?.write)}
                                    onCheckedChange={() => handleTogglePermission(member.id, p, "write")}
                                    aria-label={`${PAGE_LABELS[p]} write`}
                                  />
                                </TableCell>
                              </Fragment>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity">
                {auditLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <DataTable columns={auditColumns} data={auditRows} emptyMessage="No activity yet." />
                )}

                {auditTotal > 0 && (
                  <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Showing {from}-{to} of {auditTotal}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage === 0}
                        onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="size-3.5" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={to >= auditTotal}
                        onClick={() => setAuditPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
