import { printHtml } from "@/lib/printHtml"

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Wraps the editor's own rendered DOM (bodyHtml -- see ApplicationEditor's
// getHtml()) with print-page styling so headings/bold/lists/tables etc.
// come out looking the same as on screen, then hands off to the same
// hidden-iframe print mechanism the Applications page uses.
export function printEditorContent(bodyHtml: string, title: string): void {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 0.7in 0.9in; }
  body {
    font-family: "Nirmala UI", "Vrinda", "Noto Sans Bengali", Arial, sans-serif;
    font-size: 14.5pt;
    line-height: 1.7;
    color: #000;
  }
  /* The editor renders soft line breaks (e.g. inside a multi-line address
     or signature block) as literal newline characters, relying on its own
     "whitespace-break-spaces" CSS class to display them as real line
     breaks -- that class isn't part of the HTML this function receives
     (getHtml() grabs innerHTML, not the editor's own classes), so without
     this the newlines collapse to plain spaces and multi-line blocks
     print as one run-on line. */
  p { margin: 0 0 14pt 0; white-space: pre-wrap; }
  h1, h2, h3, h4, h5, h6 { margin: 16pt 0 10pt 0; }
  ul, ol { margin: 0 0 14pt 1.4em; padding: 0; }
  blockquote { margin: 0 0 14pt 0; padding-left: 0.75em; border-left: 2px solid #999; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 8pt 0; }
  table td, table th { border: 1px solid #000; padding: 4pt 6pt; }
  a { color: inherit; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
  printHtml(html, title)
}
