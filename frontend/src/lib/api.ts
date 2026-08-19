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
