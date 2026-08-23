import { Toaster as Sonner } from "sonner"
import type { ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      closeButton
      toastOptions={{
        classNames: {
          // data-[type=error] targets sonner's own attribute on the toast
          // element -- error toasts keep the normal card background but
          // get a red left accent border, enough to stand out from
          // ordinary toasts without turning the whole toast into a solid
          // red block.
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg data-[type=error]:!border-l-4 data-[type=error]:!border-l-red-500",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
