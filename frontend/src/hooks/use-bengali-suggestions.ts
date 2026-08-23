import { useCallback, useRef, useState } from "react"
import type { PlateEditor } from "platejs/react"
import { RangeApi } from "platejs"
import { transliterate } from "@/lib/bengali-engine"

export interface BengaliSuggestion {
  bengali: string
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

// Keyed by exact romanized word -- typing tends to reuse the same common
// words ("ami", "amar", "ekhane"...) constantly, so most lookups after the
// first become instant instead of a fresh network round-trip every time.
const suggestionCache = new Map<string, string[]>()

function getCurrentWord(editor: PlateEditor): { word: string; range: WordRange } | null {
  const { selection } = editor
  if (!selection || !RangeApi.isCollapsed(selection)) return null

  const blockEntry = editor.above({ match: (n) => editor.isBlock(n) })
  if (!blockEntry) return null
  const [, blockPath] = blockEntry
  const blockStart = editor.start(blockPath)
  if (!blockStart) return null

  const textBeforeCursor = editor.string({ anchor: blockStart, focus: selection.anchor })
  const match = /[A-Za-z]+$/.exec(textBeforeCursor)
  if (!match) return null

  const word = match[0]
  const wordStart = editor.before(selection.anchor, { distance: word.length, unit: "character" })
  if (!wordStart) return null

  return { word, range: { anchor: wordStart, focus: selection.anchor } }
}

// Google's own endpoint for its "Google Input Tools" product -- undocumented
// but public, and sends `Access-Control-Allow-Origin: *`, so it's callable
// directly from the browser with no server-side proxy needed. Dictionary-
// backed, so it returns several real candidate words ranked by likelihood
// (unlike the single deterministic output a pure phonetic-rule engine like
// avro-phonetic always gives), covering irregular spellings/loanwords the
// rule engine alone gets wrong.
async function fetchGoogleSuggestions(word: string, signal: AbortSignal): Promise<string[]> {
  const cached = suggestionCache.get(word)
  if (cached) return cached
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=bn-t-i0-und&num=8&cp=0&cs=1&ie=utf-8&oe=utf-8`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = await res.json()
    const suggestions: string[] = data?.[1]?.[0]?.[1] ?? []
    suggestionCache.set(word, suggestions)
    return suggestions
  } catch {
    return []
  }
}

function buildSuggestions(word: string, googleResults: string[]): BengaliSuggestion[] {
  const avro = transliterate(word)
  const seen = new Set<string>()
  const suggestions: BengaliSuggestion[] = []

  for (const g of googleResults) {
    if (!seen.has(g)) {
      seen.add(g)
      suggestions.push({ bengali: g, roman: word })
    }
  }
  if (!seen.has(avro)) {
    seen.add(avro)
    suggestions.push({ bengali: avro, roman: word })
  }
  if (!seen.has(word)) {
    suggestions.push({ bengali: word, roman: word })
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
// perceived speed. The instant local avro-phonetic result is NOT debounced;
// it renders every keystroke since it's free (no network).
const GOOGLE_DEBOUNCE_MS = 90

export function useBengaliSuggestions(editor: PlateEditor) {
  const [suggestions, setSuggestions] = useState<BengaliSuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [wordRange, setWordRange] = useState<WordRange | null>(null)
  const requestGenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    requestGenRef.current++
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    setSuggestions([])
    setWordRange(null)
    setSelectedIndex(0)
  }, [])

  // Called on every keystroke/selection change while Bengali is selected.
  const onUpdate = useCallback(() => {
    const current = getCurrentWord(editor)
    if (!current) {
      clear()
      return
    }

    setWordRange(current.range)
    setSuggestions([{ bengali: transliterate(current.word), roman: current.word }])
    setSelectedIndex(0)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    const gen = ++requestGenRef.current

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      fetchGoogleSuggestions(current.word, controller.signal).then((googleResults) => {
        if (requestGenRef.current !== gen) return
        setSuggestions(buildSuggestions(current.word, googleResults))
        setSelectedIndex(0)
      })
    }, GOOGLE_DEBOUNCE_MS)
  }, [editor, clear])

  const acceptSuggestion = useCallback(
    (index: number, trailing = "") => {
      const suggestion = suggestions[index]
      if (!wordRange || !suggestion) return
      editor.delete({ at: wordRange })
      editor.select(wordRange.anchor)
      editor.insertText(suggestion.bengali + trailing)
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
