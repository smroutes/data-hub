import { useNavigate } from "react-router-dom"
import { Header } from "@/components/Header"
import { ApplicationForm } from "@/components/ApplicationForm"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/lib/AuthContext"
import { createApplication } from "@/lib/applicationsApi"
import type { ApplicationInput } from "@/lib/applicationsApi"

export function NewApplication() {
  const { session } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(input: ApplicationInput) {
    if (!session) return
    const application = await createApplication(session, input)
    navigate(`/applications/${application.id}`)
  }

  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>New Application</CardTitle>
            <CardDescription>Annapurna Scheme -- nothing here is mandatory.</CardDescription>
          </CardHeader>
          <CardContent>
            <ApplicationForm onSubmit={handleSubmit} submitLabel="Save Application" />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
