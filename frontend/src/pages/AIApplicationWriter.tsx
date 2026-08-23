import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  FolderOpen,
  Lightbulb,
  Loader2,
  Printer,
  Save,
  Sparkles,
} from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { ApplicationEditor } from "@/components/editor/ApplicationEditor"
import type { ApplicationEditorHandle } from "@/components/editor/ApplicationEditor"
import { cn } from "@/lib/utils"
import { useDocumentTitle } from "@/lib/useDocumentTitle"
import { generateApplication, suggestPrompt } from "@/lib/api"
import { printEditorContent } from "@/lib/editorPrint"

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

// Caps how much text a single request can send to the (paid, per-token)
// generation API -- also enforced server-side in GenerateApplicationRequest
// so this can't be bypassed by calling the API directly.
const MAX_PROMPT_LENGTH = 2000

const CATEGORIES = [
  "Identity Documents",
  "Financial Assistance",
  "Utility Services",
  "Pension",
  "Health",
  "Education",
  "Food & Supply",
]

export function AIApplicationWriter() {
  useDocumentTitle("AI Application Writer")
  const [prompt, setPrompt] = useState("")
  const [language, setLanguage] = useState<Language>("bn")
  const [category, setCategory] = useState("")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState("")
  const [suggestion, setSuggestion] = useState("")
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Plate's `value` is only read once at construction -- bumping this key
  // forces the editor to remount (and re-deserialize) on each new
  // generation, rather than trying to sync an uncontrolled editor.
  const [resultVersion, setResultVersion] = useState(0)
  const editorRef = useRef<ApplicationEditorHandle>(null)

  // Debounced ghost-text autocomplete (Groq) -- clears immediately on any
  // edit so a stale suggestion never lingers against changed text, then
  // fetches a fresh one after the user pauses typing.
  useEffect(() => {
    setSuggestion("")
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (prompt.trim().length < 3 || generating) return

    suggestTimer.current = setTimeout(async () => {
      const s = await suggestPrompt(prompt, language, category || null)
      setSuggestion(s)
    }, 600)

    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, language, category])

  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && suggestion) {
      e.preventDefault()
      setPrompt((p) => p + suggestion)
      setSuggestion("")
    } else if (e.key === "Escape" && suggestion) {
      setSuggestion("")
    }
  }

  async function handleGenerate() {
    if (!prompt.trim() || generating) return
    // Otherwise the ghost-text suggestion (and its ready-to-accept hint)
    // stays visible over the prompt while/after generating, which reads as
    // unfinished/broken even though generation is already underway.
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    setSuggestion("")
    setGenerating(true)
    setResult("")
    try {
      const text = await generateApplication(prompt.trim(), language, category || null)
      setResult(text)
      setResultVersion((v) => v + 1)
    } catch (err) {
      // duration: Infinity -- this can explain exactly why generation
      // didn't produce a letter (e.g. an unsupported/off-topic request), so
      // it shouldn't be able to auto-dismiss and go unnoticed before the
      // user reads it. The Toaster's closeButton lets them dismiss it.
      toast.error(err instanceof Error ? err.message : "Failed to generate application.", {
        duration: Infinity,
      })
    } finally {
      setGenerating(false)
    }
  }

  function handleClear() {
    setPrompt("")
    setCategory("")
    setResult("")
  }

  function handlePrint() {
    // Empty-check via getMarkdown() (a real semantic serialization) rather
    // than getHtml(), since Plate's rendered DOM still has wrapper markup
    // even when the document is visibly empty.
    if (!(editorRef.current?.getMarkdown() ?? result).trim()) return
    printEditorContent(editorRef.current?.getHtml() ?? "", "Application")
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
              <div className="relative">
                {/* Ghost-text overlay: identical box model to the textarea
                    below, with an invisible copy of the typed text so only
                    the suggestion tail lines up after the cursor -- same
                    technique editors like Copilot use for inline
                    autocomplete. Assumes the cursor is at the end of the
                    text, which holds true while just typing forward. */}
                <div
                  aria-hidden
                  className="border-input pointer-events-none absolute inset-0 min-h-40 overflow-hidden rounded-md border border-transparent px-3 py-2 text-sm whitespace-pre-wrap break-words"
                >
                  <span className="invisible">{prompt}</span>
                  <span className="text-muted-foreground italic">{suggestion}</span>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                  onKeyDown={handlePromptKeyDown}
                  placeholder={PROMPT_PLACEHOLDER[language]}
                  maxLength={MAX_PROMPT_LENGTH}
                  className="relative min-h-40 resize-none"
                />
              </div>
              <div className="-mt-2 flex items-center justify-between text-xs text-muted-foreground">
                {suggestion ? (
                  <p>
                    Press <kbd className="rounded border bg-muted px-1 py-0.5 font-sans">Tab</kbd> to accept the
                    suggestion.
                  </p>
                ) : (
                  <span />
                )}
                <span
                  className={cn(
                    prompt.length >= MAX_PROMPT_LENGTH && "font-medium text-red-600 dark:text-red-400"
                  )}
                >
                  {prompt.length} / {MAX_PROMPT_LENGTH}
                </span>
              </div>

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

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generating}
                  className="flex-1"
                >
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
              </div>

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
                  <Button variant="outline" size="sm" onClick={handlePrint} disabled={generating}>
                    <Printer className="size-3.5" />
                    Print
                  </Button>
                  {/* Saving to a real applications list is later work. */}
                  <Button size="sm" disabled>
                    <Save className="size-3.5" />
                    Save Application
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-0">
              {generating && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-b-xl bg-white/85 backdrop-blur-sm">
                  <span className="relative flex size-12 items-center justify-center">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/30" />
                    <Sparkles className="relative size-6 text-brand" />
                  </span>
                  <p className="text-sm font-medium text-foreground">Generating your application...</p>
                  <p className="text-xs text-muted-foreground">This usually takes a few seconds.</p>
                </div>
              )}
              {/* Always mounted -- even with nothing generated yet, someone
                  should be able to just start writing by hand. Keyed by
                  resultVersion so each new generation gets a fresh editor
                  instance loaded with the new markdown -- see
                  ApplicationEditor for why (Plate's initial value isn't
                  re-read on prop changes). */}
              <div className="min-h-[36rem] rounded-b-xl bg-white text-neutral-900">
                <ApplicationEditor key={resultVersion} ref={editorRef} initialMarkdown={result} />
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
