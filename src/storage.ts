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

// Same wrappers for sessionStorage: the values survive a reload but are wiped
// when the tab/browser is closed, so a fresh visit always starts clean.
export function readSession(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // storage unavailable; the session value just won't be remembered
    return false
  }
}
