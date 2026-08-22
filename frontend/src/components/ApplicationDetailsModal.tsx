import { Printer } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SubmissionFlagBadge } from "@/components/SubmissionFlagBadge"
import { printApplication } from "@/lib/applicationPrint"
import type { Application } from "@/lib/applicationsApi"

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value?.trim() || "—"}</div>
    </div>
  )
}

// Read-only -- this page reviews applications staff already submitted, so
// there's no edit/resubmit action here (that would silently re-flip the
// submission_flag). Use the Search page's edit modal for actual changes.
export function ApplicationDetailsModal({
  open,
  onOpenChange,
  application,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: Application | null
}) {
  if (!application) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            {application.name || "—"}
            <SubmissionFlagBadge flag={application.submission_flag} />
          </DialogTitle>
          <DialogDescription>Annapurna Scheme -- application details.</DialogDescription>
        </DialogHeader>
        <div className="shrink-0 border-t" />
        <div className="flex-1 overflow-y-auto px-6">
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <Field label="Name" value={application.name} />
            <Field label="Relative Name (Father/Husband)" value={application.relative_name} />
            <Field label="Application Number" value={application.application_number} />
            <Field label="Mobile Number" value={application.mobile_number} />
            <Field label="Aadhaar Number" value={application.aadhaar_number} />
            <Field label="District" value={application.district} />
            <Field label="Block" value={application.block} />
            <Field label="Voter Number" value={application.voter_number} />
            <div className="sm:col-span-2">
              <Field label="Full Address" value={application.address} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Remarks" value={application.remarks} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end border-t p-4">
          <Button variant="outline" onClick={() => printApplication(application)}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
