import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Download, Loader2, Pencil, Printer, X } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AiApplicationStatusBadge } from "@/components/AiApplicationStatusBadge"
import { ApplicationReadOnlyView } from "@/components/editor/ApplicationReadOnlyView"
import type { ApplicationReadOnlyViewHandle } from "@/components/editor/ApplicationReadOnlyView"
import { useAuth } from "@/lib/AuthContext"
import { listAiApplicationVersions } from "@/lib/aiApplicationsApi"
import type { AiApplication, AiApplicationVersion } from "@/lib/aiApplicationsApi"
import { printEditorContent } from "@/lib/editorPrint"

const LANGUAGE_LABELS: Record<AiApplication["language"], string> = {
  bn: "বাংলা",
  en: "English",
  hi: "हिंदी",
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Field({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={wrap ? "text-sm whitespace-pre-wrap text-foreground" : "text-sm text-foreground"}>{value}</div>
    </div>
  )
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
  const [tab, setTab] = useState<"preview" | "details">("preview")
  const viewRef = useRef<ApplicationReadOnlyViewHandle>(null)

  useEffect(() => {
    if (!open || !application || !session) return
    setLoading(true)
    setVersions([])
    setSelectedVersion(application.version)
    setTab("preview")
    listAiApplicationVersions(session, application.id)
      .then(setVersions)
      .finally(() => setLoading(false))
  }, [open, application, session])

  if (!application) return null

  const activeVersion = versions.find((v) => v.version === selectedVersion)
  const content = activeVersion?.content_markdown ?? application.content_markdown
  const status = activeVersion?.status ?? application.status

  async function handlePrint() {
    const html = (await viewRef.current?.getPrintHtml()) ?? ""
    printEditorContent(html, application!.title)
  }

  async function handleDownload() {
    const html = (await viewRef.current?.getPrintHtml()) ?? ""
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${application!.title}</title></head><body>${html}</body></html>`
    const blob = new Blob([doc], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${application!.title || "application"}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Downloaded.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 gap-2 p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* leading-normal overrides DialogTitle's default
                  leading-none -- Bengali (and other Indic scripts)
                  routinely draw vowel signs/conjuncts above the roman
                  em-box, which a line-height of exactly 1 doesn't leave
                  room for, clipping the top of the glyphs. */}
              <DialogTitle className="truncate leading-normal" title={application.title}>
                {application.title}
              </DialogTitle>
              <div className="mt-1.5">
                <AiApplicationStatusBadge status={status} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
              <DialogPrimitive.Close className="cursor-pointer rounded-sm text-muted-foreground opacity-70 outline-none hover:opacity-100">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "preview" | "details")} className="min-h-0 flex-1 gap-0">
          <div className="shrink-0 px-6">
            <TabsList variant="line" className="h-10">
              <TabsTrigger
                value="preview"
                className="data-[state=active]:text-brand data-[state=active]:after:bg-brand"
              >
                Preview
              </TabsTrigger>
              <TabsTrigger
                value="details"
                className="data-[state=active]:text-brand data-[state=active]:after:bg-brand"
              >
                Details
              </TabsTrigger>
            </TabsList>
          </div>

          {/* forceMount + data-[state=inactive]:hidden instead of Radix's
              default unmount-when-inactive -- Print/Download read from
              viewRef, which must stay mounted (and non-null) even while
              the Details tab is showing, not just while Preview is
              active. */}
          <TabsContent
            forceMount
            value="preview"
            className="min-h-0 overflow-y-auto p-6 data-[state=inactive]:hidden"
          >
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border bg-white p-6 text-neutral-900">
                {/* Keyed by version -- Plate only reads its initial value
                    once at construction (same constraint
                    ApplicationEditor.tsx's resultVersion remount works
                    around), so switching versions needs a fresh instance. */}
                <ApplicationReadOnlyView key={selectedVersion} ref={viewRef} markdown={content} />
              </div>
            )}
          </TabsContent>

          <TabsContent
            forceMount
            value="details"
            className="min-h-0 overflow-y-auto p-6 data-[state=inactive]:hidden"
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label="Language" value={LANGUAGE_LABELS[application.language]} />
              <Field label="Category" value={application.category || "—"} />
              <Field label="Version" value={String(activeVersion?.version ?? application.version)} />
              <Field label="Status" value={status[0].toUpperCase() + status.slice(1)} />
              <Field label="Created At" value={formatDateTime(application.created_at)} />
              <Field label="Last Updated" value={formatDateTime(application.updated_at)} />
              <div className="col-span-2">
                <Field label="Description" value={application.prompt || "—"} wrap />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex shrink-0 items-center justify-between border-t p-4">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="size-4" />
            Print
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="size-4" />
              Download
            </Button>
            <Button asChild>
              <Link to={`/ai-writer/${application.slug}`}>
                <Pencil className="size-4" />
                Edit Application
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
