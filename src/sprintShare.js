// Packs a sprint's settings into the URL so a link can recreate it anywhere,
// with no backend needed.

const SPRINT_PARAM = 'sprint'

function isSprintConfig(value) {
  return (
    Boolean(value) &&
    Number.isInteger(value.startHour) &&
    Number.isInteger(value.startMinute) &&
    Number.isInteger(value.endHour) &&
    Number.isInteger(value.endMinute)
  )
}

// Base64url keeps the payload safe to drop straight into a query string
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''

  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

// The link that carries a copy of the sprint's settings. When a team id is
// given, the link also drops the visitor into that shared room so tasks sync.
export function getSprintLink(config, teamId) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(SPRINT_PARAM, toBase64Url(JSON.stringify(config)))

  if (teamId) {
    url.searchParams.set('team', teamId)
  }

  return url.toString()
}

// Reads the sprint out of a "?sprint=..." link, or null when there isn't one
export function readSharedSprint() {
  try {
    const value = new URLSearchParams(window.location.search).get(SPRINT_PARAM)
    if (!value) return null

    const parsed = JSON.parse(fromBase64Url(value))

    return isSprintConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}
