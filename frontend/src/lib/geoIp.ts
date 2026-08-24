// Self-lookup of the browser's own public IP + a best-effort city/region
// guess, via ipapi.co's free tier (no API key, 1000 req/day) -- used only
// to label the presence heartbeat (AuthContext) with something more useful
// than a bare IP for the admin "Online now" view. Deliberately best-effort:
// staff on a shared office connection will usually resolve to the same
// ISP-registered city, not a precise address, and a network error here
// must never block the app -- callers get null and just send the
// heartbeat without location info.
export interface SelfGeoIp {
  ip: string
  city: string | null
  region: string | null
  country: string | null
}

// Cheap in-memory cache: this fires once per tab per session (see
// AuthContext), not once per heartbeat -- an IP essentially never changes
// mid-session, so there's no reason to re-spend the free-tier quota on it.
let cached: Promise<SelfGeoIp | null> | null = null

async function fetchSelfGeoIp(): Promise<SelfGeoIp | null> {
  try {
    const res = await fetch("https://ipapi.co/json/")
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ip) return null
    return {
      ip: data.ip,
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country_name ?? null,
    }
  } catch {
    return null
  }
}

export function getSelfGeoIp(): Promise<SelfGeoIp | null> {
  if (!cached) cached = fetchSelfGeoIp()
  return cached
}
