import { buildPrintDocument } from "@/lib/editorPrint"

// US Letter at 96 CSS px/in -- matches the @page sizing buildPrintDocument
// already assumes for the browser print path, so this stays pixel-for-pixel
// consistent with what Print produces instead of inventing a second layout.
const PAGE_WIDTH_PX = 816
const PAGE_HEIGHT_PX = 1056

// Matches buildPrintDocument's `@page { margin: 0.7in 0.9in }` at 96 CSS
// px/in. @page margins are a paged-media concept the real browser print
// dialog honors on its own -- html2canvas just rasterizes the DOM as laid
// out, with no notion of page margins at all, so without this the content
// was bleeding edge-to-edge on every exported PDF. Applied as body padding
// here (PDF export only) rather than touching buildPrintDocument itself,
// which would double the inset on the actual print path.
const MARGIN_Y_PX = 67
const MARGIN_X_PX = 86

// jsPDF/html2canvas are only needed for this one button, and together are
// a meaningful chunk of bundle weight -- dynamically imported so they never
// load for anyone who doesn't click Download.
async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ])
  return { jsPDF, html2canvas }
}

// Renders the same document buildPrintDocument feeds to the browser print
// dialog into a hidden, same-origin iframe (identical technique to
// printHtml.ts, just without ever calling print()), rasterizes it with
// html2canvas, and slices the result into US-Letter-sized pages in a real
// jsPDF file -- so Download actually saves a .pdf straight to disk instead
// of handing control to the browser's print dialog the way Print does.
export async function downloadPdf(bodyHtml: string, title: string): Promise<void> {
  const { jsPDF, html2canvas } = await loadPdfLibs()
  const html = buildPrintDocument(bodyHtml, title)

  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.left = "-99999px"
  iframe.style.top = "0"
  iframe.style.width = `${PAGE_WIDTH_PX}px`
  iframe.style.height = `${PAGE_HEIGHT_PX}px`
  iframe.style.border = "0"
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentWindow?.document
    if (!doc) return

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve()
      doc.open()
      doc.write(html)
      doc.close()
    })

    // @font-face fonts embedded in the iframe's own <style> load
    // asynchronously -- rasterizing before they're ready silently falls
    // back to the browser default font for that frame of the capture.
    await iframe.contentDocument?.fonts.ready

    const body = iframe.contentDocument?.body
    if (!body) return
    body.style.boxSizing = "border-box"
    body.style.padding = `${MARGIN_Y_PX}px ${MARGIN_X_PX}px`
    body.style.width = `${PAGE_WIDTH_PX}px`

    const canvas = await html2canvas(body, {
      backgroundColor: "#ffffff",
      scale: 2,
      windowWidth: PAGE_WIDTH_PX,
    })

    const pdf = new jsPDF({ unit: "px", format: [PAGE_WIDTH_PX, PAGE_HEIGHT_PX] })
    const imgWidth = PAGE_WIDTH_PX
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const imgData = canvas.toDataURL("image/png")

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
    heightLeft -= PAGE_HEIGHT_PX

    while (heightLeft > 0) {
      position -= PAGE_HEIGHT_PX
      pdf.addPage([PAGE_WIDTH_PX, PAGE_HEIGHT_PX])
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= PAGE_HEIGHT_PX
    }

    pdf.save(`${title || "application"}.pdf`)
  } finally {
    iframe.remove()
  }
}
