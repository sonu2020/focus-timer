export const DAY_MINUTES = 1440

export const MIN_DIVISIONS = 1
export const MAX_DIVISIONS = 48

export const DEFAULT_TIMELINE_CONFIG = { start: 0, end: 0, divisions: 6 }

export function getSpan(start, end) {
  let total = end - start

  if (total <= 0) total += DAY_MINUTES

  return Math.min(total, DAY_MINUTES)
}

export function clampDivisions(value) {
  return Math.min(MAX_DIVISIONS, Math.max(MIN_DIVISIONS, Math.round(value)))
}

function isValidRange(value) {
  return (
    !!value &&
    Number.isInteger(value.start) &&
    value.start >= 0 &&
    value.start < DAY_MINUTES &&
    Number.isInteger(value.end) &&
    value.end >= 0 &&
    value.end < DAY_MINUTES
  )
}

function isValidDivisions(value) {
  return (
    Number.isInteger(value.divisions) &&
    value.divisions >= MIN_DIVISIONS &&
    value.divisions <= MAX_DIVISIONS
  )
}

function migrateLegacyConfig(value) {
  if (
    isValidRange(value) &&
    Number.isInteger(value.interval) &&
    value.interval > 0
  ) {
    const span = getSpan(value.start, value.end)

    return {
      start: value.start,
      end: value.end,
      divisions: clampDivisions(span / value.interval),
    }
  }

  return null
}

export function normalizeTimelineConfig(value) {
  if (isValidRange(value) && isValidDivisions(value)) {
    return { start: value.start, end: value.end, divisions: value.divisions }
  }

  return migrateLegacyConfig(value) ?? DEFAULT_TIMELINE_CONFIG
}
