import { forwardRef, useEffect, useImperativeHandle } from "react"
import { createSlateEditor } from "platejs"
import { serializeHtml } from "platejs/static"
import { Plate, usePlateEditor } from "platejs/react"
import { MarkdownPlugin } from "@platejs/markdown"
import { BasicNodesKit } from "@/components/editor/plugins/basic-nodes-kit"
import { AlignKit } from "@/components/editor/plugins/align-kit"
import { FontKit } from "@/components/editor/plugins/font-kit"
import { LineHeightKit } from "@/components/editor/plugins/line-height-kit"
import { LinkKit } from "@/components/editor/plugins/link-kit"
import { ListKit } from "@/components/editor/plugins/list-kit"
import { TableKit } from "@/components/editor/plugins/table-kit"
import { EmojiKit } from "@/components/editor/plugins/emoji-kit"
import { FixedToolbarKit } from "@/components/editor/plugins/fixed-toolbar-kit"
import { PrintStaticKit } from "@/components/editor/plugins/print-static-kit"
import { Editor, EditorContainer } from "@/components/ui/editor"
import { TransliterationSuggestionPopup } from "@/components/editor/TransliterationSuggestionPopup"
import { useTransliterationSuggestions } from "@/hooks/use-transliteration-suggestions"
import type { TransliterationLanguage } from "@/hooks/use-transliteration-suggestions"

// ListKit already brings in indent support (needed by both lists and the
// Indent/Outdent toolbar buttons), so it's not listed separately here.
const PLUGINS = [
  ...BasicNodesKit,
  ...AlignKit,
  ...FontKit,
  ...LineHeightKit,
  ...LinkKit,
  ...ListKit,
  ...TableKit,
  ...EmojiKit,
  MarkdownPlugin,
  ...FixedToolbarKit,
]

export interface ApplicationEditorHandle {
  // DeepSeek's output is markdown (headings, **bold**, etc.) -- serializing
  // back to markdown (not plain text) preserves whatever formatting the
  // user applied in the editor for Copy/Download/Save.
  getMarkdown: () => string
  // For Print. Deliberately NOT the live contentEditable DOM's innerHTML --
  // that carries Slate's own editing-DOM artifacts (e.g. it relies on a
  // "whitespace-break-spaces" CSS class, present on the on-screen editor
  // but not on whatever consumes the raw HTML, to even display line breaks
  // correctly), which Plate's own docs call out as producing inconsistent
  // results for exactly this kind of export. Instead this builds a
  // throwaway, non-interactive Slate editor from the same document value
  // and uses Plate's documented `serializeHtml` (platejs/static) to get
  // clean, semantic HTML straight from the document model.
  getPrintHtml: () => Promise<string>
}

type Language = "bn" | "en" | "hi"

function usesTransliteration(language: Language): language is TransliterationLanguage {
  return language === "bn" || language === "hi"
}

// Remount this component (via a `key` prop keyed to the generation, e.g. a
// counter bumped on each successful Generate) to load new AI output --
// Plate's `value` is only consulted once, at editor construction. Also
// used with an empty initialMarkdown so someone can start writing by hand
// without generating anything first.
export const ApplicationEditor = forwardRef<
  ApplicationEditorHandle,
  { initialMarkdown: string; language: Language }
>(function ApplicationEditor({ initialMarkdown, language }, ref) {
  const editor = usePlateEditor({
    plugins: PLUGINS,
    value: initialMarkdown.trim()
      ? (editor) => editor.getApi(MarkdownPlugin).markdown.deserialize(initialMarkdown)
      : undefined,
  })

  // Bengali/Hindi suggestions need a real language value even when the
  // active language is English -- the hook itself is inert unless onUpdate
  // is actually called (gated below), so this fallback never does anything
  // except satisfy the type.
  const { suggestions, selectedIndex, setSelectedIndex, active, onUpdate, acceptSuggestion, clear } =
    useTransliterationSuggestions(editor, usesTransliteration(language) ? language : "bn")

  // Dismiss any pending suggestion state immediately on switching to
  // English -- otherwise it lingers until the next edit (onChange is the
  // only other place this clears, and a language-pill click alone doesn't
  // fire it).
  useEffect(() => {
    if (!usesTransliteration(language)) clear()
  }, [language, clear])

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => editor.api.markdown.serialize(),
      getPrintHtml: async () => {
        const staticEditor = createSlateEditor({
          plugins: PrintStaticKit,
          value: editor.children,
        })
        return serializeHtml(staticEditor)
      },
    }),
    [editor]
  )

  return (
    <Plate editor={editor} onChange={() => usesTransliteration(language) && onUpdate()}>
      {/* !overflow-visible: EditorContainer defaults to overflow-y-auto,
          which -- regardless of whether it ever actually overflows --
          makes it the toolbar's "nearest scrolling ancestor" for
          position:sticky purposes instead of the page. Since this
          container has no capped height (it grows with content; the page
          itself scrolls), that default just breaks the toolbar's sticky
          offset: it gets measured from this container's own top instead
          of the page/header, so the sticky threshold is satisfied
          immediately and the toolbar renders permanently shifted down by
          its offset, leaving a gap above it. Overriding back to normal
          flow makes the page the sticky reference, matching the site
          header it's meant to sit below. */}
      <EditorContainer className="h-full !overflow-visible">
        <Editor
          variant="none"
          className="min-h-[44rem] px-4 py-3 text-lg"
          placeholder="Start writing, or describe what you need on the left and click Generate Application."
          onKeyDown={(e) => {
            // Formal Bengali/Hindi full stop ("।", purnochched/poorna
            // viram) -- typed as a plain "." like every phonetic typing
            // tool, but a period has no ambiguity worth a suggestion
            // popup, so it converts directly instead of going through the
            // candidate-list flow. If a word is still mid-suggestion, "."
            // finalizes it first (same as space today) rather than
            // leaving it stranded as romanized text.
            if (usesTransliteration(language) && e.key === ".") {
              e.preventDefault()
              if (active && suggestions.length > 0) {
                acceptSuggestion(selectedIndex, "।")
              } else {
                editor.insertText("।")
              }
              return
            }
            if (!usesTransliteration(language) || !active || suggestions.length === 0) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setSelectedIndex((i) => (i + 1) % suggestions.length)
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault()
              acceptSuggestion(selectedIndex)
            } else if (e.key === " ") {
              e.preventDefault()
              acceptSuggestion(selectedIndex, " ")
            } else if (e.key === "Escape") {
              e.preventDefault()
              clear()
            }
          }}
        />
      </EditorContainer>
      {usesTransliteration(language) && (
        <TransliterationSuggestionPopup
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelect={(i) => acceptSuggestion(i)}
          onHover={setSelectedIndex}
        />
      )}
    </Plate>
  )
})
