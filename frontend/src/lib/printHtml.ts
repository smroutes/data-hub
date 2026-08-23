// Shared by applicationPrint.ts (Applications page) and the AI Writer
// canvas -- renders a full HTML document into a hidden iframe and opens
// the browser's native print dialog on it, so both features print
// identically rather than each rolling their own iframe/print plumbing.
export function printHtml(html: string, title: string): void {
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Chrome's "Save as PDF" filename comes from the TOP window's
  // document.title at the moment print() fires -- not the iframe's own
  // title -- since the print dialog is tab-level browser chrome, not
  // frame-level. Swap it in for the duration of the print job.
  const originalTitle = document.title
  document.title = title

  function restoreTitle() {
    document.title = originalTitle
  }

  function cleanup() {
    restoreTitle()
    iframe.remove()
  }

  window.addEventListener("afterprint", cleanup, { once: true })
  iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true })

  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    // Some browsers never fire afterprint on the iframe when print() is
    // called across frames -- this is the fallback so the tab title (and
    // the iframe) don't stay stuck indefinitely.
    setTimeout(cleanup, 60_000)
  }
}
