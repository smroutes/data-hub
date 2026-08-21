import { Link } from "react-router-dom"
import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDocumentTitle } from "@/lib/useDocumentTitle"

export function NotFound() {
  useDocumentTitle("Page Not Found")
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-orange-600 shadow-sm">
        <Database className="size-7 text-white" strokeWidth={2.25} />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This page doesn't exist or may have moved.
        </p>
      </div>
      <Button asChild className="mt-2">
        <Link to="/">Back to DataHub</Link>
      </Button>
    </div>
  )
}
