import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  FolderOpen,
  Lightbulb,
  Loader2,
  Pencil,
  Printer,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

// The generated letter already states its own subject in whatever
// language it was written in ("বিষয়:" / "Subject:" / "विषय:") -- reusing
// that as the card header avoids a second LLM call (even a cheap one)
// just to summarize what the first call already said, and it's
// automatically in the right language since it's the model's own text,
// not a translation we'd have to get right ourselves.
const MAX_HEADER_TITLE_LENGTH = 60

const DEFAULT_RESULT_TITLE = "AI Generated Application"

function extractTitleFromApplication(markdown: string): string | null {
  const match = /^\**(?:বিষয়|subject|विषय)\**\s*[:ঃ]\s*(.+)$/im.exec(markdown)
  if (!match) return null
  const title = match[1]
    .replace(/\*\*/g, "")
    .replace(/[।.॥]+\s*$/, "")
    .trim()
  if (!title) return null
  return title.length > MAX_HEADER_TITLE_LENGTH
    ? title.slice(0, MAX_HEADER_TITLE_LENGTH - 1).trimEnd() + "…"
    : title
}

const GENERATING_MESSAGE: Record<Language, { title: string; subtitle: string }> = {
  bn: { title: "আপনার আবেদনটি তৈরি হচ্ছে...", subtitle: "এটি সাধারণত কয়েক সেকেন্ড সময় নেয়।" },
  en: { title: "Generating your application...", subtitle: "This usually takes a few seconds." },
  hi: { title: "आपका आवेदन तैयार किया जा रहा है...", subtitle: "इसमें आमतौर पर कुछ सेकंड लगते हैं।" },
}

const TYPEWRITER_SPEED_MS = 35

// Reveals `text` one character at a time while `active` is true -- restarts
// from scratch whenever `active` flips true->true again (a new generation
// with the same message) or `text` changes (a different language), rather
// than only reacting to `text` alone.
function useTypewriter(text: string, active: boolean, speedMs = TYPEWRITER_SPEED_MS): string {
  const [display, setDisplay] = useState("")

  useEffect(() => {
    if (!active) {
      setDisplay("")
      return
    }
    let i = 0
    setDisplay("")
    const interval = setInterval(() => {
      i++
      setDisplay(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, speedMs)
    return () => clearInterval(interval)
    // `active` is intentionally part of the key that restarts this: toggling
    // generating false->true again with the identical text/language should
    // still retype from scratch, not silently skip because `text` didn't
    // change.
  }, [text, active, speedMs])

  return display
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

export function AIApplicationWriter() {
  useDocumentTitle("AI Application Writer")
  const [prompt, setPrompt] = useState("")
  const [language, setLanguage] = useState<Language>("bn")
  const [category, setCategory] = useState("")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState("")
  const [resultTitle, setResultTitle] = useState<string | null>(null)
  // User edits are local-only for now (no save endpoint yet -- that needs
  // the DB redesign this is deferring to), so this just overrides the
  // display; it isn't persisted anywhere and resets whenever a fresh
  // title is extracted from a new generation.
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [suggestion, setSuggestion] = useState("")
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Plate's `value` is only read once at construction -- bumping this key
  // forces the editor to remount (and re-deserialize) on each new
  // generation, rather than trying to sync an uncontrolled editor.
  const [resultVersion, setResultVersion] = useState(0)
  const editorRef = useRef<ApplicationEditorHandle>(null)
  const typedGeneratingTitle = useTypewriter(GENERATING_MESSAGE[language].title, generating)

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
    setResultTitle(null)
    setIsEditingTitle(false)
    try {
      const text = await generateApplication(prompt.trim(), language, category || null)
      setResult(text)
      setResultTitle(extractTitleFromApplication(text))
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
    setResultTitle(null)
    setIsEditingTitle(false)
    // Plate only reads its initial value once at construction, so clearing
    // `result` alone doesn't touch the already-mounted editor -- the old
    // application stayed visible in the canvas even though the title/state
    // around it had reset. Bumping this remounts ApplicationEditor with a
    // genuinely empty initialMarkdown, the same mechanism handleGenerate
    // already uses to load in new content.
    setResultVersion((v) => v + 1)
  }

  async function handlePrint() {
    // Empty-check via getMarkdown() (a real semantic serialization) rather
    // than getPrintHtml(), since a static render still has wrapper markup
    // even when the document is visibly empty.
    if (!(editorRef.current?.getMarkdown() ?? result).trim()) return
    const html = (await editorRef.current?.getPrintHtml()) ?? ""
    printEditorContent(html, "Application")
  }

  function startEditingTitle() {
    setTitleDraft(resultTitle ?? DEFAULT_RESULT_TITLE)
    setIsEditingTitle(true)
  }

  function commitTitleEdit() {
    const trimmed = titleDraft.trim()
    setResultTitle(trimmed || null)
    setIsEditingTitle(false)
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

          {/* min-w-0: a CSS grid item defaults to min-width:auto same as a
              flex item -- without this, this Card could grow past its
              lg:grid-cols-[2fr_3fr] track to fit the title's full
              untruncated content instead of respecting the column width,
              which is what was defeating the truncate/min-w-0 fixes
              further down the tree. */}
          <Card className="min-w-0">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                {/* min-w-0 at BOTH levels is load-bearing: a flex item
                    defaults to min-width:auto, so without it here it grows
                    to fit its full untruncated content instead of shrinking
                    -- first on CardTitle (a flex item of the outer row,
                    competing with the shrink-0 button group), then again on
                    the span itself (a flex item of CardTitle's own icon+text
                    row) -- `truncate` alone can't override either. */}
                <CardTitle className="flex min-w-0 flex-1 items-center gap-2 text-base">
                  <Sparkles className="size-4 shrink-0 text-brand" />
                  {isEditingTitle ? (
                    <Input
                      ref={titleInputRef}
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={commitTitleEdit}
                      onKeyDown={(e) => {
                        // Enter isn't treated as a commit/submit key here --
                        // finalizing an edit happens by clicking away or (once
                        // built) the Save Application button, not by pressing
                        // Enter.
                        if (e.key === "Escape") {
                          e.preventDefault()
                          setIsEditingTitle(false)
                        }
                      }}
                      className="h-7 min-w-0 flex-1 text-base"
                    />
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate" title={resultTitle ?? undefined}>
                        {resultTitle ?? DEFAULT_RESULT_TITLE}
                      </span>
                      <button
                        type="button"
                        onClick={startEditingTitle}
                        disabled={generating}
                        aria-label="Edit title"
                        title="Edit title"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </>
                  )}
                </CardTitle>
                <div className="flex shrink-0 gap-2">
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
                // z-10, not z-20 -- the site header (Header.tsx) is also
                // z-20, and this overlay's tall absolute box scrolls up
                // along with the rest of the card's normal-flow content.
                // Once scrolled far enough that it occupies the same
                // on-screen region as the sticky header, equal z-index
                // falls back to DOM order, and this (rendered later, deeper
                // in <main>) was winning and painting its translucent blur
                // straight over the nav bar. Keeping it below the header's
                // z-20 fixes that regardless of scroll position.
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-b-xl bg-white/85 backdrop-blur-sm">
                  <span className="relative flex size-12 items-center justify-center">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/30" />
                    <Sparkles className="relative size-6 text-brand" />
                  </span>
                  <p className="min-h-5 text-sm font-medium text-foreground">
                    {typedGeneratingTitle}
                    <span className="animate-pulse">{typedGeneratingTitle.length < GENERATING_MESSAGE[language].title.length ? "|" : ""}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{GENERATING_MESSAGE[language].subtitle}</p>
                </div>
              )}
              {/* Always mounted -- even with nothing generated yet, someone
                  should be able to just start writing by hand. Keyed by
                  resultVersion so each new generation gets a fresh editor
                  instance loaded with the new markdown -- see
                  ApplicationEditor for why (Plate's initial value isn't
                  re-read on prop changes). */}
              <div className="min-h-[44rem] rounded-b-xl bg-white text-neutral-900">
                <ApplicationEditor key={resultVersion} ref={editorRef} initialMarkdown={result} language={language} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-amber-700">
          <TriangleAlert className="size-3.5 shrink-0" />
          AI can make mistakes. Please review the generated application before using it.
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Looking for something else? <Link to="/" className="text-brand hover:underline">Back to Home</Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}
