import { PathApi, RangeApi } from "platejs"
import { createPlatePlugin } from "platejs/react"
import { parse } from "@subhesadek/avro-phonetic"

// Only Bengali has a phonetic engine wired up (avro-phonetic) -- it's the
// long-established, widely-known scheme Bengali typists already use.
// Hindi was evaluated too (indic-transliterator's devanagari output, e.g.
// "dhanyawad" -> "धञॉअद" instead of "धन्यवाद") but was inaccurate enough
// to actively produce wrong text, so Hindi/English canvas typing stays
// plain Latin passthrough for now rather than shipping something that
// silently corrupts what the user types.
export type TransliterationLanguage = "bn" | "en" | "hi"

export interface TransliterationConfig {
  key: "transliteration"
  options: { language: TransliterationLanguage }
}

// Users fill in bracketed placeholders (e.g. "[আপনার নাম]") by hand after
// generation -- without this, doing that in Bengali requires a Bengali
// keyboard/IME most users don't have installed. This intercepts each typed
// Latin letter, re-runs the whole in-progress word through avro-phonetic,
// and replaces it in place -- the same live-as-you-type behavior as Avro
// Keyboard/Google Input Tools, since a single new letter can change how
// EARLIER letters in the same word should render (e.g. "sh", "kh" digraphs).
export const TransliterationKit = [
  createPlatePlugin<TransliterationConfig>({
    key: "transliteration",
    options: { language: "bn" },
  }).overrideEditor(({ editor, tf: { insertText, deleteBackward }, getOption }) => {
    let wordStart: { path: number[]; offset: number } | null = null
    let romanBuffer = ""

    function resetWord() {
      wordStart = null
      romanBuffer = ""
    }

    return {
      transforms: {
        insertText(text, options) {
          const selection = editor.selection
          const active = getOption("language") === "bn"

          // Only intercept single plain Latin letters typed at a collapsed
          // cursor -- paste, IME composition, digits, and punctuation all
          // pass through untouched (digits deliberately excluded: mobile
          // numbers, PIN codes, and reference numbers should stay as
          // ordinary digits, not Bengali numerals).
          if (
            !active ||
            text.length !== 1 ||
            !/^[A-Za-z]$/.test(text) ||
            !selection ||
            !RangeApi.isCollapsed(selection)
          ) {
            resetWord()
            insertText(text, options)
            return
          }

          if (wordStart && !PathApi.equals(wordStart.path, selection.anchor.path)) {
            resetWord()
          }
          if (!wordStart) {
            wordStart = { path: selection.anchor.path, offset: selection.anchor.offset }
          }

          romanBuffer += text
          const converted = parse(romanBuffer).bangla

          editor.delete({
            at: {
              anchor: { path: wordStart.path, offset: wordStart.offset },
              focus: selection.anchor,
            },
          })
          editor.select({ path: wordStart.path, offset: wordStart.offset })
          insertText(converted, options)
        },
        deleteBackward(options) {
          // The buffered roman text no longer matches the document after a
          // backspace (backspace removes converted Bengali characters, not
          // roman ones) -- start tracking a fresh word from here rather
          // than risk replacing text the user didn't just type.
          resetWord()
          deleteBackward(options)
        },
      },
    }
  }),
]
