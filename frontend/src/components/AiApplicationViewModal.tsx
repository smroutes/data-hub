import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select } from "@/components/ui/select"
import { AiApplicationStatusBadge } from "@/components/AiApplicationStatusBadge"
import { ApplicationReadOnlyView } from "@/components/editor/ApplicationReadOnlyView"
import { useAuth } from "@/lib/AuthContext"
import { listAiApplicationVersions } from "@/lib/aiApplicationsApi"
import type { AiApplication, AiApplicationVersion } from "@/lib/aiApplicationsApi"

function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Read-only -- shows the application's saved content formatted the same
// way it looks in the actual editing canvas (via ApplicationReadOnlyView),
// no toolbar or editing affordances here at all. The version dropdown lets
// someone browse the full snapshot history (ai_application_versions, one
// row per save) without leaving the modal.
export function AiApplicationViewModal({
  open,
  onOpenChange,
  application,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: AiApplication | null
}) {
  const { session } = useAuth()
  const [versions, setVersions] = useState<AiApplicationVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !application || !session) return
    setLoading(true)
    setVersions([])
    setSelectedVersion(application.version)
    listAiApplicationVersions(session, application.id)
      .then(setVersions)
      .finally(() => setLoading(false))
  }, [open, application, session])

  if (!application) return null

  const activeVersion = versions.find((v) => v.version === selectedVersion)
  const content = activeVersion?.content_markdown ?? application.content_markdown

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 gap-2 p-6 pb-4">
          <DialogTitle className="truncate pr-8" title={application.title}>
            {application.title}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedVersion ?? application.version)}
              onChange={(e) => setSelectedVersion(Number(e.target.value))}
              className="h-8 w-auto text-xs"
              disabled={loading || versions.length === 0}
            >
              {versions.length === 0 ? (
                <option value={application.version}>Version {application.version}</option>
              ) : (
                versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    Version {v.version} · {formatDate(v.created_at)}
                    {v.version === application.version ? " (current)" : ""}
                  </option>
                ))
              )}
            </Select>
            {activeVersion && <AiApplicationStatusBadge status={activeVersion.status} />}
          </div>
        </DialogHeader>
        <div className="shrink-0 border-t" />
        <div className="flex-1 overflow-y-auto bg-white px-8 py-6 text-neutral-900">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            // Keyed by version -- Plate only reads its initial value once
            // at construction (same constraint ApplicationEditor.tsx's
            // resultVersion remount works around), so switching versions
            // needs a fresh instance, not a prop update.
            <ApplicationReadOnlyView key={selectedVersion} markdown={content} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
