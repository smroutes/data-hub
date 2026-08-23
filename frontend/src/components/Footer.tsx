import { ShieldAlert } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-4 text-center text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5 shrink-0 text-brand" />
        <span>
          Internal tool for authorized personnel only — not for public or general use.
        </span>
      </div>
    </footer>
  )
}
