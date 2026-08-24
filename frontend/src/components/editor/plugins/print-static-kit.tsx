import { KEYS } from "platejs"
import { BaseTextAlignPlugin } from "@platejs/basic-styles"

import { BaseBasicBlocksKit } from "@/components/editor/plugins/basic-blocks-base-kit"
import { BaseBasicMarksKit } from "@/components/editor/plugins/basic-marks-base-kit"
import { BaseFontKit } from "@/components/editor/plugins/font-base-kit"
import { BaseLineHeightKit } from "@/components/editor/plugins/line-height-base-kit"
import { BaseLinkKit } from "@/components/editor/plugins/link-base-kit"
import { BaseListKit } from "@/components/editor/plugins/list-base-kit"
import { BaseTableKit } from "@/components/editor/plugins/table-base-kit"

// The non-React ("Base*") counterpart of ApplicationEditor.tsx's PLUGINS,
// used only to build a throwaway createSlateEditor() for serializeHtml().
// Static rendering (platejs/static) produces real semantic HTML from the
// Slate document model itself, instead of scraping the live contentEditable
// DOM (which carries Slate/browser editing artifacts -- e.g. it relies on a
// "whitespace-break-spaces" CSS class most consumers of the raw HTML, like
// a print stylesheet, won't replicate) -- see printEditorContent's use of
// this kit.
export const PrintStaticKit = [
  ...BaseBasicBlocksKit,
  ...BaseBasicMarksKit,
  BaseTextAlignPlugin.configure({
    inject: {
      nodeProps: {
        defaultNodeValue: "start",
        nodeKey: "align",
        styleKey: "textAlign",
        validNodeValues: ["start", "left", "center", "right", "end", "justify"],
      },
      targetPlugins: [...KEYS.heading, KEYS.p],
    },
  }),
  ...BaseFontKit,
  ...BaseLineHeightKit,
  ...BaseLinkKit,
  ...BaseListKit,
  ...BaseTableKit,
]
