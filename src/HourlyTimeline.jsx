import { useEffect, useState } from 'react'
import './HourlyTimeline.css'

const DAY_MINUTES = 1440

function getMinutesNow() {
  const now = new Date()

  return now.getHours() * 60 + now.getMinutes()
}

function formatHour(hour24) {
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return {
    time: `${String(hour12).padStart(2, '0')}:00`,
    suffix,
  }
}

function formatLabel(hour24) {
  const { time, suffix } = formatHour(hour24)

  return `${time} ${suffix}`
}

function HourlyTimeline({ config }) {
  const startHour = config?.startHour ?? 9
  const endHour = config?.endHour ?? 19
  const theme = config?.theme ?? '#52d696'

  const [minutes, setMinutes] = useState(getMinutesNow)

  useEffect(() => {
    let timeoutId

    function schedule() {
      const now = new Date()
      const msToNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds()

      timeoutId = setTimeout(
        () => {
          setMinutes(getMinutesNow())
          schedule()
        },
        Math.max(1000, msToNextMinute),
      )
    }

    function refresh() {
      setMinutes(getMinutesNow())
    }

    schedule()
    document.addEventListener('visibilitychange', refresh)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  let totalHours = ((endHour - startHour) + 24) % 24

  if (totalHours === 0) totalHours = 24

  const startMinutes = startHour * 60
  const endMinutes = endHour * 60
  const span = totalHours * 60
  const wraps = endHour <= startHour

  let elapsed = 0
  let inRange = false

  if (!wraps) {
    if (minutes >= startMinutes && minutes < endMinutes) {
      elapsed = minutes - startMinutes
      inRange = true
    }
  } else {
    const shifted = (minutes - startMinutes + DAY_MINUTES) % DAY_MINUTES

    if (shifted < span) {
      elapsed = shifted
      inRange = true
    }
  }

  const nowPercent = inRange ? (elapsed / span) * 100 : 0
  const current = formatHour(Math.floor(minutes / 60) % 24)

  function isBlockPast(index) {
    const blockEnd = startMinutes + (index + 1) * 60

    if (!wraps) {
      return minutes >= blockEnd
    }

    const shiftedNow = (minutes - startMinutes + DAY_MINUTES) % DAY_MINUTES

    return shiftedNow < span && shiftedNow >= (index + 1) * 60
  }

  const blocks = Array.from({ length: totalHours }, (_, index) => {
    const hour = (startHour + index) % 24

    return { hour, past: isBlockPast(index) }
  })

  const ticks = Array.from({ length: totalHours - 1 }, (_, index) => {
    const hour = (startHour + index + 1) % 24

    return { hour, left: ((index + 1) / totalHours) * 100 }
  })

  return (
    <section className="hourly-timeline" aria-label="Hourly timeline">
      <span className="hourly-timeline__edge hourly-timeline__edge--start">
        {formatLabel(startHour)}
      </span>

      <div className="hourly-timeline__axis">
        <div className="hourly-timeline__line" />

        {inRange && (
          <span
            className="hourly-timeline__now"
            style={{ left: `${nowPercent}%` }}
            aria-label={`Current time ${current.time} ${current.suffix}`}
          />
        )}

        {ticks.map(({ hour, left }) => (
          <span
            key={hour}
            className="hourly-timeline__tick"
            style={{ left: `${left}%` }}
          >
            <span className="hourly-timeline__tick-label">
              {formatHour(hour).time}
            </span>
          </span>
        ))}
      </div>

      <span className="hourly-timeline__edge hourly-timeline__edge--end">
        {formatLabel(endHour)}
      </span>

      <div className="hourly-timeline__grid">
        {blocks.map(({ hour, past }) => (
          <div
            key={hour}
            className={`hourly-timeline__block${
              past ? ' hourly-timeline__block--past' : ''
            }`}
            style={past ? undefined : { '--block-color': theme }}
          />
        ))}
      </div>

      <div className="hourly-timeline__status">
        <button type="button" className="hourly-timeline__pill">
          <svg
            className="hourly-timeline__pill-play"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>

          <span className="hourly-timeline__pill-text">
            Third Wave, Koramangala
          </span>

          <svg
            className="hourly-timeline__pill-caret"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </section>
  )
}

export default HourlyTimeline
