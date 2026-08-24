import { useCallback, useEffect, useRef, useState } from "react"
import type { PlateEditor } from "platejs/react"
import { RangeApi } from "platejs"
import { transliterate as transliterateBengali } from "@/lib/bengali-engine"

export type TransliterationLanguage = "bn" | "hi"

export interface TransliterationSuggestion {
  text: string
  roman: string
}

interface Point {
  path: number[]
  offset: number
}

interface WordRange {
  anchor: Point
  focus: Point
}

// itc: Google Input Tools' per-language code. localEngine: an optional
// zero-latency phonetic engine rendered immediately while the network
// request is in flight -- only Bengali has one (avro-phonetic, the
// well-established scheme Bengali typists already know). Hindi relies on
// Google's response alone: measured consistently at ~120-150ms, fast
// enough that a lower-quality local guess (the only alternative found,
// indic-transliterator's devanagari output -- e.g. "dhanyawad" ->
// "धञॉअद" instead of "धन्यवाद") isn't worth the risk of it being
// accidentally accepted before the real candidates arrive.
const LANGUAGE_CONFIG: Record<TransliterationLanguage, { itc: string; localEngine?: (word: string) => string }> = {
  bn: { itc: "bn-t-i0-und", localEngine: transliterateBengali },
  hi: { itc: "hi-t-i0-und" },
}

// Keyed by "language:word" -- the same romanized word means something
// different in each language (e.g. "na"), so a plain per-word cache would
// silently return the wrong script's result once more than one language
// has been used in a session.
const suggestionCache = new Map<string, string[]>()

function getCurrentWord(editor: PlateEditor): { word: string; range: WordRange } | null {
  const { selection } = editor
  if (!selection || !RangeApi.isCollapsed(selection)) return null

  const blockEntry = editor.api.above({ match: (n) => editor.api.isBlock(n) })
  if (!blockEntry) return null
  const [, blockPath] = blockEntry
  const blockStart = editor.api.start(blockPath)
  if (!blockStart) return null

  const textBeforeCursor = editor.api.string({ anchor: blockStart, focus: selection.anchor })
  const match = /[A-Za-z]+$/.exec(textBeforeCursor)
  if (!match) return null

  const word = match[0]
  const wordStart = editor.api.before(selection.anchor, { distance: word.length, unit: "character" })
  if (!wordStart) return null

  return { word, range: { anchor: wordStart, focus: selection.anchor } }
}

// Google's own endpoint for its "Google Input Tools" product -- undocumented
// but public, and sends `Access-Control-Allow-Origin: *`, so it's callable
// directly from the browser with no server-side proxy needed. Dictionary-
// backed, so it returns several real candidate words ranked by likelihood
// (unlike the single deterministic output a pure phonetic-rule engine
// always gives), covering irregular spellings/loanwords a rule engine
// alone gets wrong.
async function fetchGoogleSuggestions(
  word: string,
  itc: string,
  cacheKey: string,
  signal: AbortSignal
): Promise<string[]> {
  const cached = suggestionCache.get(cacheKey)
  if (cached) return cached
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=${itc}&num=8&cp=0&cs=1&ie=utf-8&oe=utf-8`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = await res.json()
    const suggestions: string[] = data?.[1]?.[0]?.[1] ?? []
    suggestionCache.set(cacheKey, suggestions)
    return suggestions
  } catch {
    return []
  }
}

function buildSuggestions(
  word: string,
  googleResults: string[],
  localEngine?: (word: string) => string
): TransliterationSuggestion[] {
  const seen = new Set<string>()
  const suggestions: TransliterationSuggestion[] = []

  for (const g of googleResults) {
    if (!seen.has(g)) {
      seen.add(g)
      suggestions.push({ text: g, roman: word })
    }
  }
  if (localEngine) {
    const local = localEngine(word)
    if (!seen.has(local)) {
      seen.add(local)
      suggestions.push({ text: local, roman: word })
    }
  }
  if (!seen.has(word)) {
    suggestions.push({ text: word, roman: word })
  }
  return suggestions
}

// Firing a fresh request on every single keystroke with no debounce at all
// was tried first and looked fine in quick manual tests, but network
// inspection showed why that's wrong: Google's endpoint rate-limits a burst
// of same-origin requests fired a few tens of ms apart (503s), so most
// keystrokes' requests silently failed and only the final, settled one
// succeeded. A short debounce -- still far below what a human perceives as
// lag -- cuts the request count enough to avoid that while barely affecting
// perceived speed. A local engine's instant result (Bengali only) is NOT
// debounced; it renders every keystroke since it's free (no network).
const GOOGLE_DEBOUNCE_MS = 90

// A word/cursor position that was just deliberately resolved to plain
// English (the identity fallback candidate), so onUpdate knows to leave it
// alone instead of re-suggesting.
interface SuppressedWord {
  path: number[]
  offset: number
  word: string
}

function pointsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function useTransliterationSuggestions(editor: PlateEditor, language: TransliterationLanguage) {
  const [suggestions, setSuggestions] = useState<TransliterationSuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [wordRange, setWordRange] = useState<WordRange | null>(null)
  const requestGenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressedWordRef = useRef<SuppressedWord | null>(null)
  // Mirrors selectedIndex for the async Google response below, which
  // closes over whatever selectedIndex was at the time the debounced
  // fetch was scheduled -- without a ref, it can't see arrow-key
  // navigation that happened while the request was in flight.
  const selectedIndexRef = useRef(0)
  useEffect(() => {
    selectedIndexRef.current = selectedIndex
  }, [selectedIndex])

  const clear = useCallback(() => {
    requestGenRef.current++
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    setSuggestions([])
    setWordRange(null)
    setSelectedIndex(0)
  }, [])

  // Called on every keystroke/selection change while Bengali/Hindi is
  // selected.
  const onUpdate = useCallback(() => {
    const current = getCurrentWord(editor)
    if (!current) {
      clear()
      return
    }

    // The word/position the user just deliberately accepted as plain
    // English -- its reinserted text is still Latin letters ending right
    // at the cursor, which would otherwise immediately re-match here and
    // reopen the same suggestion list forever. Skip it once; typing
    // anything further changes the word and/or cursor position, which
    // naturally drops out of this check and resumes normal suggestions.
    const suppressed = suppressedWordRef.current
    if (
      suppressed &&
      current.word === suppressed.word &&
      current.range.focus.offset === suppressed.offset &&
      pointsEqual(current.range.focus.path, suppressed.path)
    ) {
      clear()
      return
    }
    suppressedWordRef.current = null

    const config = LANGUAGE_CONFIG[language]
    setWordRange(current.range)
    // No local engine (Hindi) -- leave suggestions empty until Google
    // responds rather than showing nothing useful; the popup just doesn't
    // appear yet, which is fine given the ~120-150ms turnaround.
    setSuggestions(config.localEngine ? [{ text: config.localEngine(current.word), roman: current.word }] : [])
    setSelectedIndex(0)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    const gen = ++requestGenRef.current
    const cacheKey = `${language}:${current.word}`

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      fetchGoogleSuggestions(current.word, config.itc, cacheKey, controller.signal).then((googleResults) => {
        if (requestGenRef.current !== gen) return
        const built = buildSuggestions(current.word, googleResults, config.localEngine)
        // Google's response (~120-150ms) frequently lands after the user
        // has already arrow-key-navigated the instant local-engine list
        // that renders first -- resetting to index 0 here silently threw
        // that selection away and snapped the highlight back to the top,
        // which read as the popup randomly "jumping" while navigating.
        // Re-find the previously selected candidate by text in the merged
        // list instead of blindly resetting.
        setSuggestions((prev) => {
          const prevSelected = prev[selectedIndexRef.current]
          const matchedIndex = prevSelected ? built.findIndex((s) => s.text === prevSelected.text) : -1
          setSelectedIndex(matchedIndex === -1 ? 0 : matchedIndex)
          return built
        })
      })
    }, GOOGLE_DEBOUNCE_MS)
  }, [editor, language, clear])

  const acceptSuggestion = useCallback(
    (index: number, trailing = "") => {
      const suggestion = suggestions[index]
      if (!wordRange || !suggestion) return
      editor.tf.delete({ at: wordRange })
      editor.tf.select(wordRange.anchor)
      editor.tf.insertText(suggestion.text + trailing)
      // Only the identity fallback (plain typed word, always last in the
      // list) needs suppressing -- every other candidate replaces the
      // Latin word with non-Latin script, which already fails to re-match
      // on its own. A trailing character (space/Enter accept) also moves
      // the cursor off the word, so it doesn't need this either.
      suppressedWordRef.current =
        !trailing && suggestion.text === suggestion.roman
          ? {
              path: wordRange.anchor.path,
              offset: wordRange.anchor.offset + suggestion.text.length,
              word: suggestion.text,
            }
          : null
      clear()
    },
    [editor, wordRange, suggestions, clear]
  )

  return {
    suggestions,
    selectedIndex,
    setSelectedIndex,
    active: !!wordRange,
    onUpdate,
    acceptSuggestion,
    clear,
  }
}
