import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { TransliterationSuggestion } from "@/hooks/use-transliteration-suggestions"

interface TransliterationSuggestionPopupProps {
  suggestions: TransliterationSuggestion[]
  selectedIndex: number
  onSelect: (index: number) => void
  onHover: (index: number) => void
}

// Positioned via the browser's own Selection API (getBoundingClientRect on
// the current caret range) rather than any Plate/Slate-specific coordinate
// utility -- the editor is a real contentEditable div, so this works
// regardless of the rich-text layer built on top of it.
export function TransliterationSuggestionPopup({
  suggestions,
  selectedIndex,
  onSelect,
  onHover,
}: TransliterationSuggestionPopupProps) {
  const [rect, setRect] = useState<{ top: number; left: number; bottom: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (suggestions.length === 0) {
      setRect(null)
      return
    }
    const measure = () => {
      const domSelection = window.getSelection()
      if (!domSelection || domSelection.rangeCount === 0) return
      const domRect = domSelection.getRangeAt(0).getBoundingClientRect()
      setRect({ top: domRect.top, left: domRect.left, bottom: domRect.bottom })
    }
    measure()
    // `fixed` positioning is relative to the viewport, not the (scrolled)
    // editor container, so without this the popup stays frozen in place
    // while the caret it's supposed to point at moves with the page --
    // `capture: true` catches scroll on the editor's own scrolling
    // ancestor too, not just window.
    window.addEventListener("scroll", measure, { capture: true, passive: true })
    return () => window.removeEventListener("scroll", measure, { capture: true })
    // Re-measured on every suggestions update (i.e. every keystroke), which
    // keeps the popup tracking the caret as the word grows/shrinks.
  }, [suggestions])

  // Keep the keyboard-selected candidate visible when the list is taller
  // than its scroll container -- otherwise arrowing down past the
  // viewport-clamped max height leaves the highlighted item invisible.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  if (!rect || suggestions.length === 0) return null

  return (
    <div
      className="fixed z-50 flex max-w-56 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
      style={{ top: rect.bottom + 4, left: rect.left, maxHeight: `min(20rem, calc(100vh - ${rect.bottom + 4}px - 8px))` }}
    >
      <div ref={listRef} className="flex flex-col gap-0.5 overflow-y-auto p-1">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            data-index={i}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(i)
            }}
            className={cn(
              "flex shrink-0 items-center justify-between rounded-md px-2.5 py-1.5 text-left text-base transition-colors",
              i === selectedIndex
                ? "bg-primary text-primary-foreground"
                : "text-popover-foreground hover:bg-muted"
            )}
          >
            <span>{s.text}</span>
            {i === 0 && (
              <span
                className={cn(
                  "ml-2 shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                  i === selectedIndex
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted-foreground/15 text-muted-foreground"
                )}
              >
                ↵
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="shrink-0 border-t border-border px-2.5 py-1">
        <p className="text-[10px] text-muted-foreground/70">↑↓ navigate · Enter/Space accept · Esc dismiss</p>
      </div>
    </div>
  )
}
