// Avro Phonetic transliteration engine (MIT licensed, ported from hitblast/avro.py)

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
const CONSONANTS = new Set([
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
  'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z',
])
const CASE_SENSITIVES = new Set(['O', 'I'])

type Rule = {
  matches: Array<{ type: 'prefix' | 'suffix'; scope: string; value?: string }>
  replace: string
}

type Pattern = {
  find?: string
  replace: string
  rules?: Rule[]
}

const PATTERNS: Pattern[] = [
  { find: 'bhl', replace: 'ভ্ল' },
  { find: 'psh', replace: 'পশ' },
  { find: 'bdh', replace: 'ব্ধ' },
  { find: 'bj', replace: 'ব্জ' },
  { find: 'bd', replace: 'ব্দ' },
  { find: 'bb', replace: 'ব্ব' },
  { find: 'bl', replace: 'ব্ল' },
  { find: 'bh', replace: 'ভ' },
  { find: 'vl', replace: 'ভ্ল' },
  { find: 'b', replace: 'ব' },
  { find: 'v', replace: 'ভ' },
  { find: 'cNG', replace: 'চ্ঞ' },
  { find: 'cch', replace: 'চ্ছ' },
  { find: 'cc', replace: 'চ্চ' },
  { find: 'ch', replace: 'ছ' },
  { find: 'c', replace: 'চ' },
  { find: 'dhn', replace: 'ধ্ন' },
  { find: 'dhm', replace: 'ধ্ম' },
  { find: 'dgh', replace: 'দ্ঘ' },
  { find: 'ddh', replace: 'দ্ধ' },
  { find: 'dbh', replace: 'দ্ভ' },
  { find: 'dv', replace: 'দ্ভ' },
  { find: 'dm', replace: 'দ্ম' },
  { find: 'DD', replace: 'ড্ড' },
  { find: 'Dh', replace: 'ঢ' },
  { find: 'dh', replace: 'ধ' },
  { find: 'dg', replace: 'দ্গ' },
  { find: 'dd', replace: 'দ্দ' },
  { find: 'D', replace: 'ড' },
  { find: 'd', replace: 'দ' },
  { find: '...', replace: '...' },
  { find: '.`', replace: '.' },
  { find: '..', replace: '।।' },
  { find: '.', replace: '।' },
  { find: 'ghn', replace: 'ঘ্ন' },
  { find: 'Ghn', replace: 'ঘ্ন' },
  { find: 'gdh', replace: 'গ্ধ' },
  { find: 'Gdh', replace: 'গ্ধ' },
  { find: 'gN', replace: 'গ্ণ' },
  { find: 'GN', replace: 'গ্ণ' },
  { find: 'gn', replace: 'গ্ন' },
  { find: 'Gn', replace: 'গ্ন' },
  { find: 'gm', replace: 'গ্ম' },
  { find: 'Gm', replace: 'গ্ম' },
  { find: 'gl', replace: 'গ্ল' },
  { find: 'Gl', replace: 'গ্ল' },
  { find: 'gg', replace: 'জ্ঞ' },
  { find: 'GG', replace: 'জ্ঞ' },
  { find: 'Gg', replace: 'জ্ঞ' },
  { find: 'gG', replace: 'জ্ঞ' },
  { find: 'gh', replace: 'ঘ' },
  { find: 'Gh', replace: 'ঘ' },
  { find: 'g', replace: 'গ' },
  { find: 'G', replace: 'গ' },
  { find: 'hN', replace: 'হ্ণ' },
  { find: 'hn', replace: 'হ্ন' },
  { find: 'hm', replace: 'হ্ম' },
  { find: 'hl', replace: 'হ্ল' },
  { find: 'h', replace: 'হ' },
  { find: 'jjh', replace: 'জ্ঝ' },
  { find: 'jNG', replace: 'জ্ঞ' },
  { find: 'jh', replace: 'ঝ' },
  { find: 'jj', replace: 'জ্জ' },
  { find: 'j', replace: 'জ' },
  { find: 'J', replace: 'জ' },
  { find: 'kkhN', replace: 'ক্ষ্ণ' },
  { find: 'kShN', replace: 'ক্ষ্ণ' },
  { find: 'kkhm', replace: 'ক্ষ্ম' },
  { find: 'kShm', replace: 'ক্ষ্ম' },
  { find: 'kxN', replace: 'ক্ষ্ণ' },
  { find: 'kxm', replace: 'ক্ষ্ম' },
  { find: 'kkh', replace: 'ক্ষ' },
  { find: 'kSh', replace: 'ক্ষ' },
  { find: 'ksh', replace: 'কশ' },
  { find: 'kx', replace: 'ক্ষ' },
  { find: 'kk', replace: 'ক্ক' },
  { find: 'kT', replace: 'ক্ট' },
  { find: 'kt', replace: 'ক্ত' },
  { find: 'kl', replace: 'ক্ল' },
  { find: 'ks', replace: 'ক্স' },
  { find: 'kh', replace: 'খ' },
  { find: 'k', replace: 'ক' },
  { find: 'lbh', replace: 'ল্ভ' },
  { find: 'ldh', replace: 'ল্ধ' },
  { find: 'lkh', replace: 'লখ' },
  { find: 'lgh', replace: 'লঘ' },
  { find: 'lph', replace: 'লফ' },
  { find: 'lk', replace: 'ল্ক' },
  { find: 'lg', replace: 'ল্গ' },
  { find: 'lT', replace: 'ল্ট' },
  { find: 'lD', replace: 'ল্ড' },
  { find: 'lp', replace: 'ল্প' },
  { find: 'lv', replace: 'ল্ভ' },
  { find: 'lm', replace: 'ল্ম' },
  { find: 'll', replace: 'ল্ল' },
  { find: 'lb', replace: 'ল্ব' },
  { find: 'l', replace: 'ল' },
  { find: 'mth', replace: 'ম্থ' },
  { find: 'mph', replace: 'ম্ফ' },
  { find: 'mbh', replace: 'ম্ভ' },
  { find: 'mpl', replace: 'মপ্ল' },
  { find: 'mn', replace: 'ম্ন' },
  { find: 'mp', replace: 'ম্প' },
  { find: 'mv', replace: 'ম্ভ' },
  { find: 'mm', replace: 'ম্ম' },
  { find: 'ml', replace: 'ম্ল' },
  { find: 'mb', replace: 'ম্ব' },
  { find: 'mf', replace: 'ম্ফ' },
  { find: 'm', replace: 'ম' },
  { find: '0', replace: '০' },
  { find: '1', replace: '১' },
  { find: '2', replace: '২' },
  { find: '3', replace: '৩' },
  { find: '4', replace: '৪' },
  { find: '5', replace: '৫' },
  { find: '6', replace: '৬' },
  { find: '7', replace: '৭' },
  { find: '8', replace: '৮' },
  { find: '9', replace: '৯' },
  { find: 'NgkSh', replace: 'ঙ্ক্ষ' },
  { find: 'Ngkkh', replace: 'ঙ্ক্ষ' },
  { find: 'NGch', replace: 'ঞ্ছ' },
  { find: 'Nggh', replace: 'ঙ্ঘ' },
  { find: 'Ngkh', replace: 'ঙ্খ' },
  { find: 'NGjh', replace: 'ঞ্ঝ' },
  { find: 'ngOU', replace: 'ঙ্গৌ' },
  { find: 'ngOI', replace: 'ঙ্গৈ' },
  { find: 'Ngkx', replace: 'ঙ্ক্ষ' },
  { find: 'NGc', replace: 'ঞ্চ' },
  { find: 'nch', replace: 'ঞ্ছ' },
  { find: 'njh', replace: 'ঞ্ঝ' },
  { find: 'ngh', replace: 'ঙ্ঘ' },
  { find: 'Ngk', replace: 'ঙ্ক' },
  { find: 'Ngx', replace: 'ঙ্ষ' },
  { find: 'Ngg', replace: 'ঙ্গ' },
  { find: 'Ngm', replace: 'ঙ্ম' },
  { find: 'NGj', replace: 'ঞ্জ' },
  { find: 'ndh', replace: 'ন্ধ' },
  { find: 'nTh', replace: 'ন্ঠ' },
  { find: 'NTh', replace: 'ণ্ঠ' },
  { find: 'nth', replace: 'ন্থ' },
  { find: 'nkh', replace: 'ঙ্খ' },
  { find: 'ngo', replace: 'ঙ্গ' },
  { find: 'nga', replace: 'ঙ্গা' },
  { find: 'ngi', replace: 'ঙ্গি' },
  { find: 'ngI', replace: 'ঙ্গী' },
  { find: 'ngu', replace: 'ঙ্গু' },
  { find: 'ngU', replace: 'ঙ্গূ' },
  { find: 'nge', replace: 'ঙ্গে' },
  { find: 'ngO', replace: 'ঙ্গো' },
  { find: 'NDh', replace: 'ণ্ঢ' },
  { find: 'nsh', replace: 'নশ' },
  { find: 'Ngr', replace: 'ঙর' },
  { find: 'NGr', replace: 'ঞর' },
  { find: 'ngr', replace: 'ংর' },
  { find: 'nj', replace: 'ঞ্জ' },
  { find: 'Ng', replace: 'ঙ' },
  { find: 'NG', replace: 'ঞ' },
  { find: 'nk', replace: 'ঙ্ক' },
  { find: 'ng', replace: 'ং' },
  { find: 'nn', replace: 'ন্ন' },
  { find: 'NN', replace: 'ণ্ণ' },
  { find: 'Nn', replace: 'ণ্ন' },
  { find: 'nm', replace: 'ন্ম' },
  { find: 'Nm', replace: 'ণ্ম' },
  { find: 'nd', replace: 'ন্দ' },
  { find: 'nT', replace: 'ন্ট' },
  { find: 'NT', replace: 'ণ্ট' },
  { find: 'nD', replace: 'ন্ড' },
  { find: 'ND', replace: 'ণ্ড' },
  { find: 'nt', replace: 'ন্ত' },
  { find: 'ns', replace: 'ন্স' },
  { find: 'nc', replace: 'ঞ্চ' },
  { find: 'n', replace: 'ন' },
  { find: 'N', replace: 'ণ' },
  {
    find: 'OI`',
    replace: 'ৈ',
  },
  { find: 'OU`', replace: 'ৌ' },
  { find: 'O`', replace: 'ো' },
  {
    find: 'OI',
    replace: 'ৈ',
    rules: [
      { matches: [{ type: 'prefix', scope: '!consonant' }], replace: 'ঐ' },
      { matches: [{ type: 'prefix', scope: 'punctuation' }], replace: 'ঐ' },
    ],
  },
  {
    find: 'OU',
    replace: 'ৌ',
    rules: [
      { matches: [{ type: 'prefix', scope: '!consonant' }], replace: 'ঔ' },
      { matches: [{ type: 'prefix', scope: 'punctuation' }], replace: 'ঔ' },
    ],
  },
  {
    find: 'O',
    replace: 'ো',
    rules: [
      { matches: [{ type: 'prefix', scope: '!consonant' }], replace: 'ও' },
      { matches: [{ type: 'prefix', scope: 'punctuation' }], replace: 'ও' },
    ],
  },
  { find: 'phl', replace: 'ফ্ল' },
  { find: 'pT', replace: 'প্ট' },
  { find: 'pt', replace: 'প্ত' },
  { find: 'pn', replace: 'প্ন' },
  { find: 'pp', replace: 'প্প' },
  { find: 'pl', replace: 'প্ল' },
  { find: 'ps', replace: 'প্স' },
  { find: 'ph', replace: 'ফ' },
  { find: 'fl', replace: 'ফ্ল' },
  { find: 'f', replace: 'ফ' },
  { find: 'p', replace: 'প' },
  { find: 'rri`', replace: 'ৃ' },
  {
    find: 'rri',
    replace: 'ৃ',
    rules: [
      { matches: [{ type: 'prefix', scope: '!consonant' }], replace: 'ঋ' },
      { matches: [{ type: 'prefix', scope: 'punctuation' }], replace: 'ঋ' },
    ],
  },
  { find: 'rrZ', replace: 'ড়্য' },
  { find: 'rr', replace: 'ড়' },
  { find: 'Rg', replace: 'ড়্গ' },
  { find: 'Rh', replace: 'ড়্হ' },
  { find: 'R', replace: 'ড়' },
  { find: 'r', replace: 'র' },
  { find: 'shch', replace: 'শ্ছ' },
  { find: 'ShTh', replace: 'ষ্ঠ' },
  { find: 'Shph', replace: 'ষ্ফ' },
  { find: 'sht', replace: 'শ্ত' },
  { find: 'shn', replace: 'শ্ন' },
  { find: 'shm', replace: 'শ্ম' },
  { find: 'shl', replace: 'শ্ল' },
  { find: 'shb', replace: 'শ্ব' },
  { find: 'shd', replace: 'শ্দ' },
  { find: 'shg', replace: 'শ্গ' },
  { find: 'ShN', replace: 'ষ্ণ' },
  { find: 'ShT', replace: 'ষ্ট' },
  { find: 'Shn', replace: 'ষ্ণ' },
  { find: 'ShT', replace: 'ষ্ট' },
  { find: 'sNh', replace: 'স্ণ' },
  { find: 'skl', replace: 'স্ক্ল' },
  { find: 'skh', replace: 'স্খ' },
  { find: 'sth', replace: 'স্থ' },
  { find: 'sph', replace: 'স্ফ' },
  { find: 'sk', replace: 'স্ক' },
  { find: 'Sh', replace: 'ষ' },
  { find: 'sh', replace: 'শ' },
  { find: 'sq', replace: 'স্ক' },
  { find: 'sn', replace: 'স্ন' },
  { find: 'sm', replace: 'স্ম' },
  { find: 'sl', replace: 'স্ল' },
  { find: 'sb', replace: 'স্ব' },
  { find: 'sp', replace: 'স্প' },
  { find: 'st', replace: 'স্ত' },
  { find: 'S', replace: 'শ' },
  { find: 's', replace: 'স' },
  { find: 'tth', replace: 'ত্থ' },
  { find: 'Tth', replace: 'ট্থ' },
  { find: 'T', replace: 'ট' },
  { find: 'tt', replace: 'ত্ত' },
  { find: 'tn', replace: 'ত্ন' },
  { find: 'tm', replace: 'ত্ম' },
  { find: 'th', replace: 'থ' },
  { find: 't', replace: 'ত' },
  { find: 'aZ', replace: 'অ্যা' },
  { find: 'AZ', replace: 'অ্যা' },
  { find: 'a`', replace: 'া' },
  { find: 'A`', replace: 'া' },
  {
    find: 'a',
    replace: 'া',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'আ',
      },
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'prefix', scope: '!exact', value: 'a' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'য়া',
      },
      {
        matches: [
          { type: 'prefix', scope: 'exact', value: 'a' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'আ',
      },
    ],
  },
  { find: 'i`', replace: 'ি' },
  {
    find: 'i',
    replace: 'ি',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ই',
      },
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ই',
      },
    ],
  },
  { find: 'I`', replace: 'ী' },
  {
    find: 'I',
    replace: 'ী',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ঈ',
      },
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ঈ',
      },
    ],
  },
  { find: 'u`', replace: 'ু' },
  {
    find: 'u',
    replace: 'ু',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'উ',
      },
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'উ',
      },
    ],
  },
  { find: 'U`', replace: 'ূ' },
  {
    find: 'U',
    replace: 'ূ',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ঊ',
      },
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ঊ',
      },
    ],
  },
  { find: 'ee`', replace: 'ী' },
  {
    find: 'ee',
    replace: 'ী',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ঈ',
      },
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'ঈ',
      },
    ],
  },
  { find: 'e`', replace: 'ে' },
  {
    find: 'e',
    replace: 'ে',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'এ',
      },
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'এ',
      },
    ],
  },
  { find: 'oo`', replace: 'ু' },
  {
    find: 'oo',
    replace: 'ু',
    rules: [
      {
        matches: [
          { type: 'prefix', scope: '!consonant' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'উ',
      },
      {
        matches: [
          { type: 'prefix', scope: 'punctuation' },
          { type: 'suffix', scope: '!exact', value: '`' },
        ],
        replace: 'উ',
      },
    ],
  },
  { find: 'oZ', replace: 'অ্য' },
  {
    find: 'o',
    replace: 'ো',
    rules: [
      { matches: [{ type: 'prefix', scope: '!consonant' }], replace: 'ও' },
      { matches: [{ type: 'prefix', scope: 'punctuation' }], replace: 'ও' },
    ],
  },
  {
    find: 'wZ',
    replace: 'ওয়',
    rules: [
      {
        matches: [{ type: 'prefix', scope: 'punctuation' }],
        replace: 'ওয়',
      },
    ],
  },
  {
    find: 'w',
    replace: 'ওয়',
    rules: [
      {
        matches: [{ type: 'prefix', scope: 'punctuation' }],
        replace: 'ওয়',
      },
    ],
  },
  { find: 'x', replace: 'ক্স' },
  {
    find: 'y',
    replace: '্য',
    rules: [
      { matches: [{ type: 'prefix', scope: 'punctuation' }], replace: 'য' },
      {
        matches: [{ type: 'prefix', scope: '!consonant' }],
        replace: 'য়',
      },
    ],
  },
  { find: 'Y', replace: 'য়' },
  { find: 'q', replace: 'ক' },
  { find: 'Q', replace: 'ক' },
  { find: 'Z', replace: 'য' },
  { find: 'z', replace: 'য' },
]

function fixCase(text: string): string {
  return text
    .split('')
    .map((ch) => (CASE_SENSITIVES.has(ch) ? ch : ch.toLowerCase()))
    .join('')
}

function isVowel(ch: string): boolean {
  return VOWELS.has(ch.toLowerCase())
}

function isConsonant(ch: string): boolean {
  return CONSONANTS.has(ch.toLowerCase())
}

function isPunctuation(ch: string): boolean {
  return !isVowel(ch) && !isConsonant(ch)
}

function processMatch(
  match: { type: 'prefix' | 'suffix'; scope: string; value?: string },
  text: string,
  cur: number,
  curEnd: number
): boolean {
  const { type, scope, value } = match
  const chk = type === 'prefix' ? cur - 1 : curEnd
  const negative = scope.startsWith('!')
  const actualScope = negative ? scope.slice(1) : scope

  let result = false

  if (actualScope === 'punctuation') {
    result =
      (chk < 0 && type === 'prefix') ||
      (chk >= text.length && type === 'suffix') ||
      isPunctuation(text[chk])
  } else if (actualScope === 'vowel') {
    result =
      ((chk >= 0 && type === 'prefix') || (chk < text.length && type === 'suffix')) &&
      isVowel(text[chk])
  } else if (actualScope === 'consonant') {
    result =
      ((chk >= 0 && type === 'prefix') || (chk < text.length && type === 'suffix')) &&
      isConsonant(text[chk])
  } else if (actualScope === 'exact' && value !== undefined) {
    const start = type === 'prefix' ? cur - value.length : curEnd
    const end = type === 'prefix' ? cur : curEnd + value.length
    result = start >= 0 && end <= text.length && text.slice(start, end) === value
  }

  return negative ? !result : result
}

function processRules(
  rules: Rule[],
  text: string,
  cur: number,
  curEnd: number
): string | null {
  for (const rule of rules) {
    const allMatch = rule.matches.every((m) => processMatch(m, text, cur, curEnd))
    if (allMatch) return rule.replace
  }
  return null
}

export function transliterate(input: string): string {
  const text = fixCase(input)
  const output: string[] = []
  let cur = 0

  while (cur < text.length) {
    let matched = false

    for (const pattern of PATTERNS) {
      if (!pattern.find) continue
      const find = pattern.find
      if (text.startsWith(find, cur)) {
        const curEnd = cur + find.length

        if (pattern.rules) {
          const ruleResult = processRules(pattern.rules, text, cur, curEnd)
          if (ruleResult !== null) {
            output.push(ruleResult)
          } else {
            output.push(pattern.replace)
          }
        } else {
          output.push(pattern.replace)
        }

        cur = curEnd
        matched = true
        break
      }
    }

    if (!matched) {
      output.push(text[cur])
      cur++
    }
  }

  return output.join('')
}

// Transliterate word-by-word and return Bengali for current word being typed
export function transliterateWord(word: string): string {
  return transliterate(word)
}
