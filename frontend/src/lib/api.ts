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
    throw new Error(body?.detail || `Request failed (${res.status})`)
  }
  const data = (await res.json()) as { application: string }
  return data.application
}
