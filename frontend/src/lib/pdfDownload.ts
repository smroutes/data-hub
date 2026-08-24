import { buildPrintDocument } from "@/lib/editorPrint"

// A4 (210mm x 297mm) at 96 CSS px/in -- matches buildPrintDocument's own
// `@page { size: A4 }` for the browser print path, so this stays
// pixel-for-pixel consistent with what Print produces instead of
// inventing a second layout.
const PAGE_WIDTH_PX = 794
const PAGE_HEIGHT_PX = 1123

// jsPDF's own "px" unit doesn't mean CSS px (96/in) -- it's a legacy 72/in
// mapping, so handing it PAGE_WIDTH_PX/PAGE_HEIGHT_PX directly for the
// actual PDF page size produced a page ~33% too large in real-world
// dimensions (still LOOKED fine on screen since a PDF viewer fits it to
// the window either way, only visible if measured or physically printed).
// Converting to pt ourselves (72/in, the unit jsPDF's page geometry
// actually uses) up front sidesteps that entirely -- only the page/image
// geometry passed to jsPDF uses this; DOM layout and html2canvas capture
// stay in real CSS px throughout.
const PX_TO_PT = 0.75
const PAGE_WIDTH_PT = PAGE_WIDTH_PX * PX_TO_PT
const PAGE_HEIGHT_PT = PAGE_HEIGHT_PX * PX_TO_PT

// Matches buildPrintDocument's `@page { margin: 0.7in 0.9in }` at 96 CSS
// px/in. @page margins are a paged-media concept the real browser print
// dialog honors on its own -- html2canvas just rasterizes the DOM as laid
// out, with no notion of page margins at all, so without this the content
// was bleeding edge-to-edge on every exported PDF. Applied as body padding
// here (PDF export only) rather than touching buildPrintDocument itself,
// which would double the inset on the actual print path.
const MARGIN_Y_PX = 67
const MARGIN_X_PX = 86

// buildPrintDocument's 14.5pt body size reads fine on an actual printed
// page, but the same size rasterized into a PDF (viewed on-screen, not
// held in hand) reads oversized -- scaled down for this export path only,
// same reasoning as the margin override above.
const PDF_FONT_SIZE_PT = 11

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
// html2canvas, and slices the result into A4-sized pages in a real jsPDF
// file -- so Download actually saves a .pdf straight to disk instead of
// handing control to the browser's print dialog the way Print does.
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
    body.style.fontSize = `${PDF_FONT_SIZE_PT}pt`

    const canvas = await html2canvas(body, {
      backgroundColor: "#ffffff",
      scale: 2,
      windowWidth: PAGE_WIDTH_PX,
    })

    const pdf = new jsPDF({ unit: "pt", format: [PAGE_WIDTH_PT, PAGE_HEIGHT_PT] })
    const imgWidth = PAGE_WIDTH_PT
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const imgData = canvas.toDataURL("image/png")

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
    heightLeft -= PAGE_HEIGHT_PT

    while (heightLeft > 0) {
      position -= PAGE_HEIGHT_PT
      pdf.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT])
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= PAGE_HEIGHT_PT
    }

    pdf.save(`${title || "application"}.pdf`)
  } finally {
    iframe.remove()
  }
}
