import { printHtml } from "@/lib/printHtml"
// ?inline forces Vite to base64-inline these regardless of size (its
// default assetsInlineLimit is 4kb; these are ~45kb each) -- self-hosting
// the font directly in the print document, rather than naming a system
// font by name and hoping it's installed, is what actually guarantees
// consistent rendering. Named system fonts ("Nirmala UI", "Vrinda") are
// Windows-only and silently fall back to whatever the OS substitutes when
// missing (e.g. nothing Bengali-capable on this Mac); a fallback font
// without proper Bengali shaping rules can render a dependent vowel sign
// (e.g. the "ে" in "হবে") incorrectly or drop it visually, even though the
// underlying text is untouched -- confirmed by comparing canvas vs. print
// text content directly (byte-identical) rather than assuming the visual
// difference meant real data loss.
import notoBengaliRegular from "@/assets/fonts/noto-sans-bengali-400.woff2?inline"
import notoBengaliBold from "@/assets/fonts/noto-sans-bengali-700.woff2?inline"
// Noto Sans Bengali doesn't cover Devanagari (Hindi) -- separate family,
// same self-hosting reasoning.
import notoDevanagariRegular from "@/assets/fonts/noto-sans-devanagari-400.woff2?inline"
import notoDevanagariBold from "@/assets/fonts/noto-sans-devanagari-700.woff2?inline"

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Wraps the editor's static, non-interactive HTML render (bodyHtml -- see
// ApplicationEditor's getPrintHtml(), built via Plate's serializeHtml
// rather than scraped from the live contentEditable DOM) with print-page
// styling so headings/bold/lists/tables etc. come out looking right.
// Shared by printEditorContent (feeds this into the browser's print
// dialog) and pdfDownload.ts (rasterizes this same markup into an actual
// .pdf file client-side) so both surfaces stay pixel-identical instead of
// maintaining the font-embedding/spacing rules twice.
//
// serializeHtml's paragraph/hr components render as a plain <div>, not
// <p> -- Plate's own SlateElement defaults to <div> unless a component
// explicitly overrides the tag (headings and blockquote do; paragraphs
// don't). PlateStatic itself already wraps the whole document in its own
// root (class "slate-editor"), so spacing rules below target ITS direct
// children (one per top-level block) rather than assuming tag names that
// aren't actually there or adding a second, redundant wrapper.
export function buildPrintDocument(bodyHtml: string, title: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @font-face {
    font-family: "Noto Sans Bengali";
    src: url("${notoBengaliRegular}") format("woff2");
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: "Noto Sans Bengali";
    src: url("${notoBengaliBold}") format("woff2");
    font-weight: 700;
    font-style: normal;
  }
  @font-face {
    font-family: "Noto Sans Devanagari";
    src: url("${notoDevanagariRegular}") format("woff2");
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: "Noto Sans Devanagari";
    src: url("${notoDevanagariBold}") format("woff2");
    font-weight: 700;
    font-style: normal;
  }
  @page { size: A4; margin: 0.7in 0.9in; }
  body {
    font-family: "Noto Sans Bengali", "Noto Sans Devanagari", Arial, sans-serif;
    font-size: 14.5pt;
    line-height: 1.7;
    color: #000;
    /* A soft line break within a block (e.g. a multi-line address or
       signature block) is a literal newline character in the served text,
       not a <br> -- white-space inherits to every descendant, so setting
       it once here preserves those breaks everywhere instead of
       collapsing them to plain spaces (the exact bug this replaces). */
    white-space: pre-wrap;
  }
  .slate-editor > div { margin: 0 0 14pt 0; }
  .slate-editor > h1, .slate-editor > h2, .slate-editor > h3,
  .slate-editor > h4, .slate-editor > h5, .slate-editor > h6 { margin: 16pt 0 10pt 0; }
  .slate-editor > ul, .slate-editor > ol { margin: 0 0 14pt 1.4em; padding: 0; }
  .slate-editor > blockquote { margin: 0 0 14pt 0; padding-left: 0.75em; border-left: 2px solid #999; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 8pt 0; }
  table td, table th { border: 1px solid #000; padding: 4pt 6pt; }
  a { color: inherit; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

// Hands the built document off to the same hidden-iframe print mechanism
// the Applications page uses.
export function printEditorContent(bodyHtml: string, title: string): void {
  printHtml(buildPrintDocument(bodyHtml, title), title)
}
