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

export async function suggestPrompt(
  text: string,
  language: string,
  category: string | null
): Promise<string> {
  const res = await fetch("/api/suggest-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, category }),
  })
  if (!res.ok) return "" // best-effort -- never surface an error for this
  const data = (await res.json()) as { suggestion: string }
  return data.suggestion
}

// A bare "Request failed (502)" with no further detail means the request
// never reached our own app at all -- a gateway/proxy-level failure (the
// backend restarting, a dev-server proxy with nothing listening yet,
// etc.), so `detail` from our own JSON error body is never present for
// those. Translate the common gateway codes into something a non-technical
// user can actually act on; anything else falls back to the raw detail
// (our own HTTPExceptions always set a real message) or a generic retry
// prompt.
function friendlyErrorMessage(status: number, detail?: string | null): string {
  if (detail) return detail
  if (status === 502 || status === 503 || status === 504) {
    return "The AI service is temporarily unavailable. Please try again in a moment."
  }
  return "Something went wrong. Please try again."
}

export async function generateApplication(
  prompt: string,
  language: string,
  category: string | null
): Promise<string> {
  const res = await fetch("/api/generate-application", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, language, category }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(friendlyErrorMessage(res.status, body?.detail))
  }
  const data = (await res.json()) as { application: string }
  return data.application
}
