import { cn } from "@/lib/utils"

const LABELS = {
  newly_submitted: "Newly Submitted",
  re_submitted: "Re-Submitted",
} as const

const COLORS = {
  newly_submitted: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  re_submitted: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
} as const

export function SubmissionFlagBadge({
  flag,
  className,
}: {
  flag: "newly_submitted" | "re_submitted" | null | undefined
  className?: string
}) {
  if (!flag) return null

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        COLORS[flag],
        className
      )}
    >
      {LABELS[flag]}
    </span>
  )
}
