import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Loader2, Pencil } from "lucide-react"
import { Header } from "@/components/Header"
import { ApplicationForm } from "@/components/ApplicationForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/lib/AuthContext"
import { getApplication, updateApplication } from "@/lib/applicationsApi"
import type { Application, ApplicationInput } from "@/lib/applicationsApi"

const FIELDS: { key: keyof Application; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "application_number", label: "Application Number" },
  { key: "mobile_number", label: "Mobile Number" },
  { key: "aadhaar_number", label: "Aadhaar Number" },
  { key: "district", label: "District" },
  { key: "block", label: "Block" },
  { key: "address", label: "Full Address" },
  { key: "voter_number", label: "Voter Number" },
]

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!session || !id) return
    getApplication(session, id)
      .then(setApplication)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false))
  }, [session, id])

  async function handleSave(input: ApplicationInput) {
    if (!session || !id) return
    const updated = await updateApplication(session, id, input)
    setApplication(updated)
    setEditing(false)
  }

  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link
          to="/search"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to search
        </Link>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {application && !editing && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{application.name || "Application"}</CardTitle>
                <CardDescription>Annapurna Scheme</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                {FIELDS.map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-3 gap-2 py-2 text-sm">
                    <dt className="text-muted-foreground col-span-1">{label}</dt>
                    <dd className="col-span-2 break-words">{application[key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {application && editing && (
          <Card>
            <CardHeader>
              <CardTitle>Edit Application</CardTitle>
              <CardDescription>Annapurna Scheme</CardDescription>
            </CardHeader>
            <CardContent>
              <ApplicationForm initial={application} onSubmit={handleSave} submitLabel="Save Changes" />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
