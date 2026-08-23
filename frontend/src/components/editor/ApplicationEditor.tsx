import { forwardRef, useImperativeHandle } from "react"
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
import { Editor, EditorContainer } from "@/components/ui/editor"

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
}

// Remount this component (via a `key` prop keyed to the generation, e.g. a
// counter bumped on each successful Generate) to load new AI output --
// Plate's `value` is only consulted once, at editor construction. Also
// used with an empty initialMarkdown so someone can start writing by hand
// without generating anything first.
export const ApplicationEditor = forwardRef<ApplicationEditorHandle, { initialMarkdown: string }>(
  function ApplicationEditor({ initialMarkdown }, ref) {
    const editor = usePlateEditor({
      plugins: PLUGINS,
      value: initialMarkdown.trim()
        ? (editor) => editor.getApi(MarkdownPlugin).markdown.deserialize(initialMarkdown)
        : undefined,
    })

    useImperativeHandle(
      ref,
      () => ({
        getMarkdown: () => editor.api.markdown.serialize(),
      }),
      [editor]
    )

    return (
      <Plate editor={editor}>
        <EditorContainer className="h-full">
          <Editor
            variant="none"
            className="min-h-96 px-4 py-3 text-sm"
            placeholder="Start writing, or describe what you need on the left and click Generate Application."
          />
        </EditorContainer>
      </Plate>
    )
  }
)
