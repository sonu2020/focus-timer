import { useEffect, useState } from 'react'
import {
  DAY_MINUTES,
  MAX_DIVISIONS,
  MIN_DIVISIONS,
  clampDivisions,
  getSpan,
} from './timelineConfig'

const LOCATIONS = [
  'Koramangala Thirdwave Coffeshop',
  'Indiranagar 100ft Road Cafe',
  'Cubbon Park Quiet Lawn',
]

function getMinutesNow() {
  const now = new Date()

  return now.getHours() * 60 + now.getMinutes()
}

const INITIAL_MINUTES = getMinutesNow()

function toTimeValue(minutes) {
  const normalized = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0')
  const mins = String(normalized % 60).padStart(2, '0')

  return `${hours}:${mins}`
}

function fromTimeValue(value) {
  const [hours, mins] = value.split(':').map(Number)

  if (!Number.isInteger(hours) || !Number.isInteger(mins)) return null

  return (hours * 60 + mins) % DAY_MINUTES
}

function formatTimeLabel(minutes) {
  const normalized = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const suffix = normalized < 720 ? 'AM' : 'PM'
  const hour24 = Math.floor(normalized / 60)
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return {
    time: `${hour12}:${String(normalized % 60).padStart(2, '0')}`,
    suffix,
  }
}

function findActive(start, span, divisions, nowMinutes) {
  const perBar = span / divisions
  const candidates = [nowMinutes, nowMinutes + DAY_MINUTES]

  for (const candidate of candidates) {
    const offset = candidate - start

    if (offset >= 0 && offset < span) {
      const exact = offset / perBar
      const index = Math.min(Math.floor(exact), divisions - 1)
      const fill = Math.min(100, Math.max(0, (exact - index) * 100))

      return { index, fill }
    }
  }

  return null
}

function TimelineView({ config, onChange }) {
  const [locationIndex, setLocationIndex] = useState(0)
  const [divisionDraft, setDivisionDraft] = useState(null)
  const [nowMinutes, setNowMinutes] = useState(INITIAL_MINUTES)

  useEffect(() => {
    const id = setInterval(() => setNowMinutes(getMinutesNow()), 10000)

    return () => clearInterval(id)
  }, [])

  const { start, divisions } = config
  const span = getSpan(start, config.end)
  const perBar = span / divisions
  const active = findActive(start, span, divisions, nowMinutes)
  const rangeFinished = active === null && nowMinutes >= start
  const dense = divisions > 12
  const labelCharWidth = dense ? 2.75 : 4.4
  const markerFontSize = `max(7px, min(18px, ${(
    100 /
    (divisions * labelCharWidth)
  ).toFixed(2)}cqw))`
  const shownDivisions = divisionDraft ?? String(divisions)

  function update(patch) {
    onChange({ ...config, ...patch })
  }

  function commitDivisions() {
    const parsed = Number.parseInt(divisionDraft ?? '', 10)

    setDivisionDraft(null)

    if (!Number.isInteger(parsed)) return

    const value = clampDivisions(parsed)

    if (value !== divisions) update({ divisions: value })
  }

  function changeLocation() {
    setLocationIndex((index) => (index + 1) % LOCATIONS.length)
  }

  return (
    <section className="timeline" aria-label="Timeline and ambient view">
      <div className="timeline-controls">
        <label className="timeline-control">
          <span>Start Time</span>
          <input
            type="time"
            value={toTimeValue(config.start)}
            onChange={(event) => {
              const value = fromTimeValue(event.target.value)

              if (value !== null) update({ start: value })
            }}
          />
        </label>

        <label className="timeline-control">
          <span>End Time</span>
          <input
            type="time"
            value={toTimeValue(config.end)}
            onChange={(event) => {
              const value = fromTimeValue(event.target.value)

              if (value !== null) update({ end: value })
            }}
          />
        </label>

        <label className="timeline-control">
          <span>Divide Your Time</span>
          <input
            className="divisions-input"
            type="number"
            inputMode="numeric"
            min={MIN_DIVISIONS}
            max={MAX_DIVISIONS}
            value={shownDivisions}
            onChange={(event) => setDivisionDraft(event.target.value)}
            onBlur={commitDivisions}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDivisions()
              }
            }}
          />
        </label>
      </div>

      <div
        className={`timeline-markers${dense ? ' timeline-markers--dense' : ''}`}
        style={{ gridTemplateColumns: `repeat(${divisions}, 1fr)` }}
      >
        {Array.from({ length: divisions }, (_, index) => {
          const { time, suffix } = formatTimeLabel(
            Math.round(start + index * perBar),
          )
          const minor = divisions > 5 && index % 2 === 1

          return (
            <div
              key={index}
              className={`timeline-marker${minor ? ' minor' : ''}`}
              style={{ fontSize: markerFontSize }}
            >
              <span className="marker-time">{time}</span>
              <span className="marker-suffix">{suffix}</span>
            </div>
          )
        })}
      </div>

      <div
        className="timeline-bars"
        style={{ gridTemplateColumns: `repeat(${divisions}, 1fr)` }}
      >
        {Array.from({ length: divisions }, (_, index) => {
          let barClass = 'future'

          if (active) {
            barClass =
              index < active.index
                ? 'past'
                : index === active.index
                  ? 'now'
                  : 'future'
          } else if (rangeFinished) {
            barClass = 'past'
          }

          return (
            <div
              key={index}
              className={`timeline-bar ${barClass}`}
              style={
                active && index === active.index
                  ? { '--fill': `${active.fill.toFixed(1)}%` }
                  : undefined
              }
            />
          )
        })}
      </div>

      <div className="timeline-status">
        <div className="timeline-status-left">
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">{LOCATIONS[locationIndex]}</span>
        </div>

        <button className="status-change" onClick={changeLocation}>
          Change
        </button>
      </div>
    </section>
  )
}

export default TimelineView
