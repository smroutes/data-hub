import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Copy,
  Download,
  FileText,
  FolderOpen,
  Lightbulb,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useDocumentTitle } from "@/lib/useDocumentTitle"

type Language = "bn" | "en" | "hi"

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "bn", label: "বাংলা" },
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी" },
]

const PROMPT_PLACEHOLDER: Record<Language, string> = {
  bn: "যেমন: আমি জন্ম সার্টিফিকেটের জন্য পৌরসভায় আবেদন করতে আমার নাম, ঠিকানা, জন্ম তারিখ, পিতার নাম উল্লেখ থাকবে।",
  en: "e.g. I want to apply for a birth certificate at the municipality, mentioning my name, address, date of birth, and father's name.",
  hi: "उदाहरण: मैं जन्म प्रमाण पत्र के लिए नगर पालिका में आवेदन करना चाहता हूँ, जिसमें मेरा नाम, पता, जन्म तिथि और पिता का नाम शामिल हो।",
}

const CATEGORIES = [
  "Identity Documents",
  "Financial Assistance",
  "Utility Services",
  "Pension",
  "Health",
  "Education",
  "Food & Supply",
]

// Phase 1 is UI-only -- there's no AI backend wired up yet, so Generate
// fills the canvas with a fixed sample so the layout/flow can be reviewed.
// Real generation (and making the canvas editable) is later work.
const SAMPLE_RESULT = `জন্ম সার্টিফিকেটের জন্য আবেদনপত্র

প্রতি,
মাননীয় পৌরসভা কর্তৃপক্ষ,
[আপনার পৌরসভার নাম]
[পৌরসভার ঠিকানা]

বিষয়: জন্ম সার্টিফিকেট প্রদানের জন্য আবেদন।

জনাব,
বিনীত নিবেদন এই যে, আমি নিম্নস্বাক্ষরকারী আমার জন্ম সার্টিফিকেটের জন্য আবেদন জানাচ্ছি।
আমার ব্যক্তিগত তথ্য নিম্নরূপ:

- আবেদনকারীর নাম: [আপনার নাম]
- পিতার নাম: [পিতার নাম]
- মাতার নাম: [মাতার নাম]
- জন্ম তারিখ: [জন্ম তারিখ]
- জন্ম স্থান: [জন্ম স্থান]
- বর্তমান ঠিকানা: [সম্পূর্ণ ঠিকানা]

অতএব, মহাশয়ের নিকট বিনীত অনুরোধ, আমার আবেদনটি বিবেচনা করে দ্রুত আমাকে জন্ম সার্টিফিকেট প্রদান করার জন্য অনুরোধ জানাচ্ছি।

ধন্যবাদান্তে,
[আপনার নাম]
[যোগাযোগ নম্বর]
[তারিখ]

---
*উল্লেখ্য: প্রয়োজনীয় কাগজপত্র সংযুক্ত করতে হবে।`

export function AIApplicationWriter() {
  useDocumentTitle("AI Application Writer")
  const [prompt, setPrompt] = useState("")
  const [language, setLanguage] = useState<Language>("bn")
  const [category, setCategory] = useState("")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState("")
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setResult("")
    // Fake latency so the loading state is visible -- swap for a real API
    // call once the AI backend exists.
    setTimeout(() => {
      setResult(SAMPLE_RESULT)
      setGenerating(false)
    }, 900)
  }

  function handleClear() {
    setPrompt("")
    setCategory("")
    setResult("")
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleDownload() {
    if (!result) return
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "application.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                AI Application Writer
              </h1>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                Beta
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Describe the application you want to create and AI will draft it for you.
            </p>
          </div>
          {/* "My Applications" (the saved-applications list) is later work --
              this links nowhere yet. */}
          <Button variant="outline" disabled>
            <FolderOpen className="size-4" />
            My Applications
          </Button>
        </div>

        {/* Canvas gets more room than the prompt panel -- it'll host a
            full rich-text editor for the generated application later, and
            needs the extra width more than the prompt form does. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_3fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Describe your application</CardTitle>
              <CardDescription>Tell AI what type of application you want to write.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={PROMPT_PLACEHOLDER[language]}
                className="min-h-40 resize-none"
              />

              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => setLanguage(lang.value)}
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      language === lang.value
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Application type <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              <Button onClick={handleGenerate} disabled={!prompt.trim() || generating}>
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate Application
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={generating}>
                Clear
              </Button>

              <div className="flex gap-2.5 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Lightbulb className="size-4 shrink-0 text-brand" />
                <p>
                  Be specific about the application type and include key details like purpose,
                  recipient, and your information.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-brand" />
                  AI Generated Application
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} disabled={!result}>
                    <Copy className="size-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} disabled={!result}>
                    <Download className="size-3.5" />
                    Download
                  </Button>
                  {/* Saving to a real applications list is later work. */}
                  <Button size="sm" disabled={!result}>
                    <Save className="size-3.5" />
                    Save Application
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-96 rounded-md border bg-white p-6 text-sm leading-relaxed whitespace-pre-wrap text-neutral-900">
                {generating ? (
                  <div className="flex h-full min-h-84 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                    <p>Generating your application...</p>
                  </div>
                ) : result ? (
                  result
                ) : (
                  <div className="flex h-full min-h-84 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <FileText className="size-8" />
                    <p>Your generated application will appear here.</p>
                    <p className="text-xs">
                      Describe what you need on the left, then click{" "}
                      <span className="font-medium">Generate Application</span>.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Looking for something else? <Link to="/" className="text-brand hover:underline">Back to Home</Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}
