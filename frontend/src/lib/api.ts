import type { SearchResult } from "@/types"

export async function searchRecords(
  fieldValues: Record<string, string>,
  datasetId: string
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ dataset: datasetId })
  for (const [key, value] of Object.entries(fieldValues)) {
    if (value.trim()) params.set(key, value.trim())
  }
  const res = await fetch(`/api/search?${params}`)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`)
  }
  return res.json()
}

export interface SuggestPromptResult {
  suggestion: string
  totalTokens: number
}

export async function suggestPrompt(
  text: string,
  language: string,
  category: string | null
): Promise<SuggestPromptResult> {
  const res = await fetch("/api/suggest-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, category }),
  })
  // best-effort -- never surface an error for this
  if (!res.ok) return { suggestion: "", totalTokens: 0 }
  const data = (await res.json()) as { suggestion: string; usage: { total_tokens: number } | null }
  return { suggestion: data.suggestion, totalTokens: data.usage?.total_tokens ?? 0 }
}

// A bare "Request failed (502)" with no further detail means the request
// never reached our own app at all -- a gateway/proxy-level failure (the
// backend restarting, a dev-server proxy with nothing listening yet,
// etc.), so `detail` from our own JSON error body is never present for
// those. Translate the common gateway codes into something a non-technical
// user can actually act on; anything else falls back to the raw detail
// (our own HTTPExceptions always set a real message) or a generic retry
// prompt.
//
// `detail` is typed unknown, not string, because FastAPI's own request
// validation (e.g. the prompt-length cap, bypassed only by calling this
// API directly rather than through the UI's own character limit) returns
// detail as an array of Pydantic error objects, not a plain string -- only
// trust it when it actually is one, so that shape doesn't get stringified
// into an unreadable toast.
function friendlyErrorMessage(status: number, detail?: unknown): string {
  if (typeof detail === "string" && detail) return detail
  if (status === 502 || status === 503 || status === 504) {
    return "The AI service is temporarily unavailable. Please try again in a moment."
  }
  if (status === 422) {
    return "That request isn't valid. Please check what you entered and try again."
  }
  return "Something went wrong. Please try again."
}

export interface GenerateApplicationResult {
  application: string
  totalTokens: number
}

export async function generateApplication(
  prompt: string,
  language: string,
  category: string | null
): Promise<GenerateApplicationResult> {
  const res = await fetch("/api/generate-application", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, language, category }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(friendlyErrorMessage(res.status, body?.detail))
  }
  const data = (await res.json()) as { application: string; usage: { total_tokens: number } | null }
  return { application: data.application, totalTokens: data.usage?.total_tokens ?? 0 }
}
