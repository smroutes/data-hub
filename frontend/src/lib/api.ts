import type { SearchResult } from "@/types"

export async function searchRecords(query: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`)
  }
  return res.json()
}
