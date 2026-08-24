import { usePlateEditor } from "platejs/react"
import { Plate } from "platejs/react"
import { MarkdownPlugin } from "@platejs/markdown"
import { BasicNodesKit } from "@/components/editor/plugins/basic-nodes-kit"
import { AlignKit } from "@/components/editor/plugins/align-kit"
import { FontKit } from "@/components/editor/plugins/font-kit"
import { LineHeightKit } from "@/components/editor/plugins/line-height-kit"
import { LinkKit } from "@/components/editor/plugins/link-kit"
import { ListKit } from "@/components/editor/plugins/list-kit"
import { TableKit } from "@/components/editor/plugins/table-kit"
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
  MarkdownPlugin,
]

// Read-only rendering of a saved application for the view modal -- reuses
// the exact same interactive plugin set as ApplicationEditor (readOnly
// just disables typing) rather than the static serializeHtml pipeline
// used for print, since Plate's list markers/indentation depend on the
// live React list components (BaseListKit's static counterpart renders
// list items as plain unmarked divs, with no bullet/number at all).
// No toolbar is rendered here, so this doesn't look or behave like an
// editor -- it's just the formatted document.
export function ApplicationReadOnlyView({ markdown }: { markdown: string }) {
  const editor = usePlateEditor({
    plugins: PLUGINS,
    value: markdown.trim()
      ? (editor) => editor.getApi(MarkdownPlugin).markdown.deserialize(markdown)
      : undefined,
  })

  return (
    <Plate editor={editor} readOnly>
      <EditorContainer className="h-full !overflow-visible">
        <Editor variant="none" readOnly className="px-0 py-0 text-sm" />
      </EditorContainer>
    </Plate>
  )
}
