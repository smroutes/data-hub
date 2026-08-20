import type { Application } from "@/lib/applicationsApi"

const BLANK = "________"

function filled(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  return trimmed || BLANK
}

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Same wording, order, and spacing as the letter template -- this just
// renders it as print-ready HTML instead of a downloaded .docx.
function buildLetterHtml(application: Application): string {
  const block = filled(application.block)

  const field = (label: string, value: string) =>
    `<p class="field"><span class="bold">${escapeHtml(label)}</span> ${escapeHtml(value)}</p>`

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Application</title>
<style>
  @page { margin: 1in 1.25in; }
  body {
    font-family: "Nirmala UI", "Vrinda", "Noto Sans Bengali", Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
  }
  p { margin: 0 0 12pt 0; }
  .justify { text-align: justify; }
  .bold { font-weight: bold; }
</style>
</head>
<body>
  <p>To</p>
  <p>The B.D.O.</p>
  <p style="margin-bottom: 24pt;">${escapeHtml(block)} Block</p>

  <p class="bold" style="margin-bottom: 24pt;">Subject: অন্নপূর্ণা যোজনার Beneficiary List-এ আমার নাম না থাকার বিষয়ে আবেদন।</p>

  <p style="margin-bottom: 18pt;">মাননীয় মহাশয়,</p>

  <p class="justify">আমি ${escapeHtml(filled(application.name))}, পিতা/স্বামী নাম ${escapeHtml(
    filled(application.relative_name)
  )},</p>
  <p class="justify" style="margin-bottom: 12pt;">${escapeHtml(
    filled(application.address)
  )}-এর বাসিন্দা, আমি অন্নপূর্ণা যোজনার একজন যোগ্য আবেদনকারী। কিন্তু অন্নপূর্ণা যোজনার Beneficiary List-এ আমার নাম এখনও প্রকাশিত হয়নি।</p>

  <p class="justify" style="margin-bottom: 24pt;">অতএব, আমার আবেদনটি দয়া করে যাচাই করে, আমি যোগ্য হলে অন্নপূর্ণা যোজনার সুবিধা পাওয়ার জন্য প্রয়োজনীয় ব্যবস্থা গ্রহণ করার জন্য আপনাকে বিনীতভাবে অনুরোধ করছি।</p>

  ${field("Application ID:", filled(application.application_number))}
  ${field("Aadhaar No.:", filled(application.aadhaar_number))}
  ${field("Mobile No.:", filled(application.mobile_number))}
  <p class="field" style="margin-bottom: 24pt;"><span class="bold">Date:</span> ${escapeHtml(today())}</p>

  <p>ধন্যবাদান্তে,</p>
  <p>${escapeHtml(filled(application.name))}</p>
</body>
</html>`
}

export function printApplication(application: Application): void {
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
  doc.write(buildLetterHtml(application))
  doc.close()

  iframe.contentWindow?.addEventListener("afterprint", () => {
    iframe.remove()
  })

  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }
}
