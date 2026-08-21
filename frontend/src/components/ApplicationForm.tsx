import { useState } from "react"
import { AlertCircle, Loader2, Printer, Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { BLOCK_GROUPS } from "@/lib/blocks"
import type { ApplicationInput } from "@/lib/applicationsApi"

const MOBILE_RE = /^[6-9]\d{9}$/
const AADHAAR_RE = /^[2-9]\d{11}$/
const KNOWN_BLOCKS = new Set(BLOCK_GROUPS.flatMap((g) => g.blocks))

export function ApplicationForm({
  initial,
  onSubmit,
  submitLabel = "Save",
}: {
  initial?: ApplicationInput
  onSubmit: (input: ApplicationInput, options: { print: boolean }) => Promise<void>
  submitLabel?: string
}) {
  const [values, setValues] = useState<
    Omit<ApplicationInput, "application_mode"> & { application_mode: string }
  >({
    name: initial?.name ?? "",
    relative_name: initial?.relative_name ?? "",
    application_number: initial?.application_number ?? "",
    mobile_number: initial?.mobile_number ?? "",
    aadhaar_number: initial?.aadhaar_number ?? "",
    district: initial?.district ?? "",
    block: initial?.block ?? "",
    address: initial?.address ?? "",
    voter_number: initial?.voter_number ?? "",
    application_mode: initial?.application_mode ?? "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState("")
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    const name = (values.name ?? "").trim()
    const address = (values.address ?? "").trim()
    const mobile = (values.mobile_number ?? "").trim()
    const aadhaar = (values.aadhaar_number ?? "").trim()

    if (!name) {
      next.name = "Name is required."
    }
    if (!address) {
      next.address = "Full address is required."
    }
    if (!mobile) {
      next.mobile_number = "Mobile number is required."
    } else if (!MOBILE_RE.test(mobile)) {
      next.mobile_number = "Enter a valid 10-digit Indian mobile number."
    }
    if (aadhaar && !AADHAAR_RE.test(aadhaar)) {
      next.aadhaar_number = "Enter a valid 12-digit Aadhaar number, or leave it blank."
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(print: boolean) {
    setSubmitError("")
    if (!validate()) {
      setSubmitError("Please fix the highlighted fields before saving.")
      return
    }

    const trimmed: ApplicationInput = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v])
    )

    setSaving(true)
    try {
      await onSubmit(trimmed, { print })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6">
        <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <Input
              value={values.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Relative Name (Father/Husband)
            </label>
            <Input
              value={values.relative_name ?? ""}
              onChange={(e) => set("relative_name", e.target.value)}
              aria-invalid={!!errors.relative_name}
            />
            {errors.relative_name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.relative_name}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Application Number
            </label>
            <Input
              value={values.application_number ?? ""}
              onChange={(e) => set("application_number", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Mobile Number <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <Input
              value={values.mobile_number ?? ""}
              onChange={(e) => set("mobile_number", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              maxLength={10}
              aria-invalid={!!errors.mobile_number}
            />
            {errors.mobile_number && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.mobile_number}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Aadhaar Number
            </label>
            <Input
              value={values.aadhaar_number ?? ""}
              onChange={(e) => set("aadhaar_number", e.target.value)}
              placeholder="12-digit Aadhaar number"
              aria-invalid={!!errors.aadhaar_number}
            />
            {errors.aadhaar_number && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.aadhaar_number}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">District</label>
            <Input value={values.district ?? ""} onChange={(e) => set("district", e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Block</label>
            <Select value={values.block ?? ""} onChange={(e) => set("block", e.target.value)}>
              <option value="">Select a block</option>
              {values.block && !KNOWN_BLOCKS.has(values.block) && (
                <option value={values.block}>{values.block}</option>
              )}
              {BLOCK_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.blocks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Full Address <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <Textarea
              value={values.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              aria-invalid={!!errors.address}
            />
            {errors.address && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.address}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Voter Number</label>
            <Input
              value={values.voter_number ?? ""}
              onChange={(e) => set("voter_number", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Application Mode
            </label>
            <Select
              value={values.application_mode}
              onChange={(e) => set("application_mode", e.target.value)}
            >
              <option value="">None</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="not_applied">Not Applied</option>
            </Select>
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t px-6 py-4">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => submit(true)}>
          <Printer className="size-4" />
          {submitLabel} and Print
        </Button>
      </div>
    </form>
  )
}
