import { cn } from "@/lib/utils"

const LABELS = {
  draft: "Draft",
  saved: "Saved",
  archived: "Archived",
} as const

const COLORS = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  saved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  archived: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
} as const

export function AiApplicationStatusBadge({
  status,
  className,
}: {
  status: "draft" | "saved" | "archived"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        COLORS[status],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {LABELS[status]}
    </span>
  )
}
