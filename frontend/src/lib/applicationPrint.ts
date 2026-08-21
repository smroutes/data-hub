import type { Application } from "@/lib/applicationsApi"

const BLANK = "________"

function filled(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim()
  return trimmed || BLANK
}

// The application's own submission date -- kept stable across re-prints,
// rather than always showing "today".
function submissionDate(application: Application): string {
  const d = new Date(application.created_at)
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
// Chrome/Edge suggest this as the "Save as PDF" filename in the print
// dialog -- so name it after the applicant instead of leaving the app's
// own title showing there. Filesystem-unsafe characters are stripped since
// this becomes a real filename.
function printTitle(application: Application): string {
  const sanitize = (v: string) => v.trim().replace(/[\\/:*?"<>|]/g, "")
  const name = sanitize(application.name ?? "")
  const appNumber = sanitize(application.application_number ?? "")
  if (name && appNumber) return `${name} - ${appNumber}`
  return name || appNumber || "Application"
}

function buildLetterHtml(application: Application): string {
  const block = filled(application.block)

  const field = (label: string, value: string) =>
    `<p class="field"><span class="bold">${escapeHtml(label)}</span> ${escapeHtml(value)}</p>`

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(printTitle(application))}</title>
<style>
  @page { margin: 0.6in 0.85in; }
  body {
    font-family: "Nirmala UI", "Vrinda", "Noto Sans Bengali", Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.4;
    color: #000;
  }
  p { margin: 0 0 8pt 0; }
  .justify { text-align: justify; }
  .bold { font-weight: bold; }
</style>
</head>
<body>
  <p>To</p>
  <p>The B.D.O.</p>
  <p style="margin-bottom: 14pt;">${escapeHtml(block)}</p>

  <p class="bold" style="margin-bottom: 14pt;">Subject: অন্নপূর্ণা যোজনার Beneficiary List-এ নাম অন্তর্ভুক্ত করার বিষয়ে আবেদন।</p>

  <p style="margin-bottom: 10pt;">মাননীয় মহাশয়,</p>

  <p class="justify">বিনীতভাবে জানাচ্ছি যে, আমি <span class="bold">${escapeHtml(
    filled(application.name)
  )}</span>, পিতা/স্বামী <span class="bold">${escapeHtml(
    filled(application.relative_name)
  )}</span>, <span class="bold">${escapeHtml(
    filled(application.address)
  )} -এর একজন বাসিন্দা।</span> আমি অন্নপূর্ণা যোজনার সুবিধা পাওয়ার জন্য আবেদন করেছি এবং উক্ত যোজনার নির্ধারিত যোগ্যতার ভিত্তিতে নিজেকে একজন উপযুক্ত আবেদনকারী বলে মনে করি।</p>

  <p class="justify">কিন্তু পরিতাপের বিষয়, অন্নপূর্ণা যোজনার <span class="bold">Beneficiary List-এ এখনও আমার নাম প্রকাশিত/অন্তর্ভুক্ত হয়নি।</span> এর ফলে আমি উক্ত যোজনার সুবিধা থেকে বঞ্চিত রয়েছি।</p>

  <p class="justify">অতএব, আমার আবেদনটি দয়া করে যথাযথভাবে <span class="bold">যাচাই ও বিবেচনা করে</span>, আমি নির্ধারিত যোগ্যতার মানদণ্ড পূরণ করলে অন্নপূর্ণা যোজনার Beneficiary List-এ আমার নাম অন্তর্ভুক্ত করার এবং যোজনার সুবিধা প্রাপ্তির জন্য <span class="bold">প্রয়োজনীয় ব্যবস্থা গ্রহণ করার জন্য বিনীতভাবে অনুরোধ করছি।</span></p>

  <p class="justify" style="margin-bottom: 14pt;">এ বিষয়ে সদয় বিবেচনা করে প্রয়োজনীয় ব্যবস্থা গ্রহণ করলে আমি আপনার নিকট চিরকৃতজ্ঞ থাকব।</p>

  ${field("Application ID:", filled(application.application_number))}
  ${field("Aadhaar No.:", filled(application.aadhaar_number))}
  ${field("Voter Card / EPIC:", filled(application.voter_number))}
  ${field("Mobile No.:", filled(application.mobile_number))}
  <p class="field" style="margin-bottom: 20pt;"><span class="bold">Date:</span> ${escapeHtml(submissionDate(application))}</p>

  <p style="text-align: right;">ধন্যবাদান্তে,</p>
  <p style="text-align: right; margin-top: 28pt;">___________________________</p>
  <p style="text-align: right;">আবেদনকারীর স্বাক্ষর</p>
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

  // Chrome's "Save as PDF" filename comes from the TOP window's
  // document.title at the moment print() fires -- not the iframe's own
  // title -- since the print dialog is tab-level browser chrome, not
  // frame-level. Swap it in for the duration of the print job.
  const originalTitle = document.title
  document.title = printTitle(application)

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
