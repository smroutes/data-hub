// No browser exposes the OS-level machine name to a webpage -- a
// deliberate anti-fingerprinting restriction in Chrome/Firefox/Safari/Edge
// alike, not something a client-side script can work around without
// installing something outside the browser on the machine. OS + browser
// family, parsed from the User-Agent string, is the closest real
// substitute available for the admin "Online now" view.
export interface UserAgentInfo {
  os: string
  browser: string
}

export function parseUserAgent(ua: string): UserAgentInfo {
  let os = "Unknown OS"
  if (/Windows/.test(ua)) os = "Windows"
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS"
  else if (/Mac OS X/.test(ua)) os = "macOS"
  else if (/Android/.test(ua)) os = "Android"
  else if (/Linux/.test(ua)) os = "Linux"

  // Order matters: Edge and Opera's UA strings also contain "Chrome", and
  // Chrome's also contains "Safari" -- each check below excludes the
  // higher-priority browsers it could otherwise be mistaken for.
  let browser = "Unknown Browser"
  if (/Edg\//.test(ua)) browser = "Edge"
  else if (/OPR\//.test(ua)) browser = "Opera"
  else if (/Chrome\//.test(ua)) browser = "Chrome"
  else if (/Firefox\//.test(ua)) browser = "Firefox"
  else if (/Safari\//.test(ua)) browser = "Safari"

  return { os, browser }
}
