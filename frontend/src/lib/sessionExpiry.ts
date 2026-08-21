// Tiny pub-sub so plain fetch helpers (applicationsApi.ts) can signal an
// expired/invalid session without importing React context -- AuthContext
// subscribes and turns this into a blocking "please log in again" modal,
// since a 401 buried in an inline error message under a table is easy to
// miss and leaves the page looking like it's just broken.
type Listener = () => void

const listeners = new Set<Listener>()

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function signalSessionExpired(): void {
  listeners.forEach((listener) => listener())
}
