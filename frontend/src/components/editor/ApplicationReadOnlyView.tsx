import { forwardRef, useImperativeHandle } from "react"
import { createSlateEditor } from "platejs"
import { serializeHtml } from "platejs/static"
import { usePlateEditor } from "platejs/react"
import { Plate } from "platejs/react"
import { MarkdownKit } from "@/components/editor/plugins/markdown-kit"
import { BasicNodesKit } from "@/components/editor/plugins/basic-nodes-kit"
import { AlignKit } from "@/components/editor/plugins/align-kit"
import { FontKit } from "@/components/editor/plugins/font-kit"
import { LineHeightKit } from "@/components/editor/plugins/line-height-kit"
import { LinkKit } from "@/components/editor/plugins/link-kit"
import { ListKit } from "@/components/editor/plugins/list-kit"
import { TableKit } from "@/components/editor/plugins/table-kit"
import { PrintStaticKit } from "@/components/editor/plugins/print-static-kit"
import { Editor, EditorContainer } from "@/components/ui/editor"

// Same node/mark plugins ApplicationEditor.tsx uses -- deliberately
// without FixedToolbarKit (which injects the formatting toolbar into the
// page regardless of readOnly) and EmojiKit (a typing-time autocomplete,
// meaningless once nothing can be typed).
const PLUGINS = [
  ...BasicNodesKit,
  ...AlignKit,
  ...FontKit,
  ...LineHeightKit,
  ...LinkKit,
  ...ListKit,
  ...TableKit,
  MarkdownKit,
]

export interface ApplicationReadOnlyViewHandle {
  // Same static-HTML approach ApplicationEditor.getPrintHtml() uses --
  // fine for Print/Download (a standalone document with no Tailwind
  // Preflight to strip list-style), unlike the on-screen live view below,
  // which needed the real interactive list components instead.
  getPrintHtml: () => Promise<string>
}

// Read-only rendering of a saved application for the view modal -- reuses
// the exact same interactive plugin set as ApplicationEditor (readOnly
// just disables typing) rather than the static serializeHtml pipeline
// used for print, since Plate's list markers/indentation depend on the
// live React list components (BaseListKit's static counterpart renders
// list items as plain unmarked divs, with no bullet/number at all).
// No toolbar is rendered here, so this doesn't look or behave like an
// editor -- it's just the formatted document.
export const ApplicationReadOnlyView = forwardRef<ApplicationReadOnlyViewHandle, { markdown: string }>(
  function ApplicationReadOnlyView({ markdown }, ref) {
    const editor = usePlateEditor({
      plugins: PLUGINS,
      value: markdown.trim()
        ? (editor) => editor.getApi(MarkdownKit).markdown.deserialize(markdown)
        : undefined,
    })

    useImperativeHandle(
      ref,
      () => ({
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
      <Plate editor={editor} readOnly>
        <EditorContainer className="h-full !overflow-visible">
          <Editor variant="none" readOnly className="px-0 py-0 text-sm" />
        </EditorContainer>
      </Plate>
    )
  }
)
