import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ApplicationForm } from "@/components/ApplicationForm"
import { useAuth } from "@/lib/AuthContext"
import { createApplication, updateApplication } from "@/lib/applicationsApi"
import { printApplication } from "@/lib/applicationPrint"
import type { Application, ApplicationInput } from "@/lib/applicationsApi"

export function ApplicationFormModal({
  open,
  onOpenChange,
  application,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  application?: Application | null
  onSaved?: (application: Application) => void
}) {
  const { session } = useAuth()
  const isEdit = !!application

  async function handleSubmit(input: ApplicationInput, { print }: { print: boolean }) {
    if (!session) return
    // Not user-editable: new records are "newly submitted", and editing an
    // existing record (whether staff-entered or synced from the CSV) counts
    // as a resubmission.
    const payload: ApplicationInput = {
      ...input,
      submission_flag: isEdit ? "re_submitted" : "newly_submitted",
    }
    const saved = isEdit
      ? await updateApplication(session, application.id, payload, "search")
      : await createApplication(session, payload, "search")
    onOpenChange(false)
    onSaved?.(saved)
    if (print) printApplication(saved)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 p-6 pb-4">
          <DialogTitle>{isEdit ? "Edit Application" : "New Application"}</DialogTitle>
          <DialogDescription>
            Annapurna Scheme -- Name, Block, Mobile Number, and Full Address are required.
          </DialogDescription>
        </DialogHeader>
        <div className="shrink-0 border-t" />
        <ApplicationForm
          key={application?.id ?? "new"}
          initial={application ?? undefined}
          onSubmit={handleSubmit}
          submitLabel={isEdit ? "Save Changes" : "Save Application"}
        />
      </DialogContent>
    </Dialog>
  )
}
