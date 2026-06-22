/** A small, safe wrapper for browser localStorage. */
export function readStoredText(key: string, fallback = ''): string {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStoredText(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in private browsing or restrictive environments.
  }
}

export function removeStoredValue(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Clearing is best-effort for the same reason as saving.
  }
}
