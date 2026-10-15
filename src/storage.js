// Thin, safe wrappers around localStorage. Browsers can throw when storage is
// disabled or full, so every read/write fails soft instead of crashing.

export function readStored(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // storage unavailable; the value just won't be remembered
    return false
  }
}

export function removeStored(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    // storage unavailable; there's nothing to clear
    return false
  }
}
