import {
  MarkdownPlugin,
  defaultRules,
  parseAttributes,
  propsToAttributes,
  convertChildrenDeserialize,
  remarkMdx,
} from "@platejs/markdown"
import type { MdRules } from "@platejs/markdown"

const DEFAULT_ALIGN = "start"

// "blockalign" rather than "align" -- deserialization dispatch resolves a
// custom MDX element's tag name through the SAME node-type->plugin-key
// lookup used for real Slate plugins (getPluginKey), and "align" happens
// to already map to TextAlignPlugin's own key ("textAlign") for unrelated
// reasons. That collision silently redirected our custom rule lookup to
// "textAlign" (which has no rule registered), so the deserializer fell
// through to the "unknown MDX node" fallback and rendered the whole
// wrapper as flattened plain text -- traced with instrumented logging
// directly in node_modules/@platejs/markdown/dist/index.js. An
// unambiguous tag name sidesteps the whole collision.
const ALIGN_TAG = "blockalign"

// Return type is deliberately `any`, not `unknown` -- MdRules' serialize
// signatures expect a specific mdast node type per key (Paragraph,
// Heading, ...), and this returns either the untouched original node or a
// synthetic mdxJsxFlowElement wrapper, neither of which is expressible as
// one shared concrete type. Matches the `any`-casted style already used
// throughout this file to bridge the same untyped-mdast-node reality.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapIfAligned(node: { align?: string }, mdastNode: unknown): any {
  const align = node.align
  if (!align || align === DEFAULT_ALIGN) return mdastNode
  return {
    type: "mdxJsxFlowElement",
    name: ALIGN_TAG,
    attributes: propsToAttributes({ value: align }),
    children: [mdastNode],
  }
}

// AlignKit (align-kit.tsx) sets an `align` prop on paragraph/heading nodes
// (start/left/center/right/end/justify) -- plain Markdown has no syntax
// for it at all, so left alone it's silently dropped every time content
// round-trips through content_markdown (bold/italic survive fine via
// native **bold**/*italic* syntax; alignment has nothing to survive as).
// Wraps an aligned block in a minimal MDX JSX element
// (<blockalign value="center">...</blockalign>), only emitted when
// non-default, on the way out, and unwraps it back into the node's
// `align` prop on the way in. Same technique @platejs/markdown's own
// built-in columnRules/mediaRules use for other block-level attributes
// plain Markdown can't natively express -- confirmed by reading their
// compiled source (node_modules/@platejs/markdown/dist/index.js) rather
// than guessing at the plugin's undocumented `rules` API.
const alignRules: MdRules = {
  p: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serialize: (node, options) => wrapIfAligned(node as any, (defaultRules.p as any).serialize(node, options)),
  },
  heading: {
    serialize: (node, options) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wrapIfAligned(node as any, (defaultRules.heading as any).serialize(node, options)),
  },
  [ALIGN_TAG]: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deserialize: (mdastNode: any, deco, options) => {
      const { value } = parseAttributes(mdastNode.attributes)
      const children = convertChildrenDeserialize(mdastNode.children, deco, options)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return children.map((child: any) => ({ ...child, align: value }))
    },
  },
}

// remarkMdx: required for the <blockalign> wrapper above to actually
// round-trip -- without it, remark-parse/remark-stringify don't
// understand MDX JSX node types at all (plain Markdown has no such
// concept), so serializing would throw on an unrecognized node type and
// deserializing would just see inert raw HTML text instead of a real
// wrapped block. Safe to enable broadly: deserializeMd already has a
// built-in fallback (re-parses without MDX) if a document ever fails to
// parse under it -- e.g. stray "<"/">" characters in AI-generated or
// hand-typed text -- so this doesn't turn arbitrary text into a hard
// parse failure.
//
// Built via a plain object spread over MarkdownPlugin.options rather than
// MarkdownPlugin.configure({...}) -- .configure()'s deferred
// __configuration mechanism (resolved at editor-construction time)
// wasn't reliably what editor.getOptions() saw afterward when combined
// with the rest of this editor's plugin kits (traced with instrumented
// logging: the registered plugin's options.rules/remarkPlugins came back
// empty/null despite configure() being called correctly -- root cause
// not fully isolated, but bypassing the deferred path via a direct
// options override sidesteps it entirely).
//
// Cast back to `typeof MarkdownPlugin` -- every other plugin in this
// object spread is a real `SlatePlugin<...>` instance from `.configure()`,
// and `usePlateEditor`'s generic plugin-array inference keys off that
// specific branded type. Without the cast, the spread's inferred type is
// just a wide structural object, which silently degrades the *entire*
// editor's inferred API (every plugin combined, not just this one) to
// `unknown` -- caught by `tsc -b` (a full `npm run build`) but invisible
// to a plain `tsc --noEmit` run against this project's root tsconfig,
// which has an empty `files` array and resolves nothing outside
// `--build` mode.
export const MarkdownKit = {
  ...MarkdownPlugin,
  options: {
    ...MarkdownPlugin.options,
    remarkPlugins: [remarkMdx],
    rules: alignRules,
  },
} as typeof MarkdownPlugin
