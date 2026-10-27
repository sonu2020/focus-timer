// Shared helpers for clock math and <input type="time"> values.
//
// A "time value" is the "HH:MM" string a time input reads and writes.
// A "minute of day" is minutes since midnight (0-1439).

export const DAY_MINUTES = 24 * 60

// (hour, minute) -> minutes since midnight
export function minutesOfDay(hour = 0, minute = 0) {
  return hour * 60 + minute
}

// Wraps any minute-of-day into the 0-1439 range
export function wrapDayMinutes(minuteOfDay) {
  return ((minuteOfDay % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
}

// minute of day -> "HH:MM"
export function toTimeValue(minuteOfDay) {
  const total = wrapDayMinutes(minuteOfDay)
  const hour = Math.floor(total / 60)
  const minute = total % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// "HH:MM" -> { hour, minute }, or null while the field is empty/incomplete
export function parseTime(value) {
  if (!value) return null

  const [h, m] = String(value).split(':')
  const hour = Number.parseInt(h, 10)
  const minute = Number.parseInt(m, 10)

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null

  return { hour, minute }
}

// Whether the current clock time has reached the sprint's start time
export function hasSprintStarted(config, now = new Date()) {
  if (!config) return false

  const start = minutesOfDay(config.startHour, config.startMinute)
  const current = minutesOfDay(now.getHours(), now.getMinutes())

  return Number.isFinite(start) && current >= start
}

// Today's date split into the two pieces the headers display
export function formatToday(date = new Date()) {
  return {
    day: date.toLocaleDateString('en-US', { weekday: 'long' }),
    monthYear: date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
  }
}
