import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2, Plus } from "lucide-react"
import { Header } from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useAuth } from "@/lib/AuthContext"
import { listApplications } from "@/lib/applicationsApi"
import type { Application } from "@/lib/applicationsApi"

export function ApplicationsList() {
  const { session } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!session) return
    listApplications(session)
      .then(setApplications)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false))
  }, [session])

  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Saved Applications</CardTitle>
              <CardDescription>Annapurna Scheme</CardDescription>
            </div>
            <Button size="sm" asChild>
              <Link to="/applications/new">
                <Plus className="size-3.5" />
                New Application
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {!loading && !error && applications.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No applications saved yet.
              </p>
            )}

            {!loading && applications.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Application Number</TableHead>
                    <TableHead>Mobile Number</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Block</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id} className="cursor-pointer">
                      <TableCell>
                        <Link to={`/applications/${app.id}`} className="block hover:underline">
                          {app.name || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{app.application_number || "—"}</TableCell>
                      <TableCell>{app.mobile_number || "—"}</TableCell>
                      <TableCell>{app.district || "—"}</TableCell>
                      <TableCell>{app.block || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
