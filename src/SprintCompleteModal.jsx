import { useState } from 'react'
import './SprintCompleteModal.css'

const DAY_MINUTES = 1440

const PRESETS = [
  { label: '+15 min', minutes: 15 },
  { label: '+30 min', minutes: 30 },
  { label: '+1 hour', minutes: 60 },
]

// minute of the day -> "HH:MM" (the format a time input uses)
function toTimeValue(minuteOfDay) {
  const total = ((minuteOfDay % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hour = Math.floor(total / 60)
  const minute = total % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// "10:14" -> { hour: 10, minute: 14 }, or null while the field is empty
function parseTime(value) {
  if (!value) return null

  const [h, m] = String(value).split(':')
  const hour = Number.parseInt(h, 10)
  const minute = Number.parseInt(m, 10)

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null

  return { hour, minute }
}

function SprintCompleteModal({ onDone, onExtend, config }) {
  const endMin = (config?.endHour ?? 19) * 60 + (config?.endMinute ?? 0)

  const [extending, setExtending] = useState(false)
  const [endTime, setEndTime] = useState(() => toTimeValue(endMin))
  const [error, setError] = useState('')

  function applyEnd(endMinuteOfDay) {
    if (endMinuteOfDay <= endMin) {
      setError('The new end time must be after the current end time.')
      return
    }

    setError('')
    onExtend({
      endHour: Math.floor(endMinuteOfDay / 60) % 24,
      endMinute: endMinuteOfDay % 60,
    })
  }

  function extendBy(minutes) {
    const chosen = parseTime(endTime)
    const base = chosen ? chosen.hour * 60 + chosen.minute : endMin
    const next = (base + minutes) % DAY_MINUTES

    setEndTime(toTimeValue(next))
    applyEnd(next)
  }

  function extendToChosen() {
    const chosen = parseTime(endTime)

    if (!chosen) {
      setError('Please enter a valid end time.')
      return
    }

    applyEnd(chosen.hour * 60 + chosen.minute)
  }

  function changeEnd(event) {
    setEndTime(event.target.value)
    setError('')
  }

  return (
    <div
      className="sprint-complete"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sprint-complete-title"
    >
      <div className="sprint-complete__dialog">
        <span className="sprint-complete__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h2 id="sprint-complete-title" className="sprint-complete__title">
          Sprint complete
        </h2>

        <p className="sprint-complete__text">
          Nicely done. Your focus sprint is finished.
        </p>

        <div className="sprint-complete__actions">
          <button
            type="button"
            className="sprint-complete__button sprint-complete__button--ghost"
            onClick={() => setExtending((value) => !value)}
            aria-expanded={extending}
          >
            Extend time
          </button>

          <button
            type="button"
            className="sprint-complete__button"
            onClick={onDone}
            autoFocus
          >
            Done
          </button>
        </div>

        {extending && (
          <div className="sprint-complete__extend">
            <div className="sprint-complete__presets" role="group">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="sprint-complete__preset"
                  onClick={() => extendBy(preset.minutes)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <label
              className="sprint-complete__label"
              htmlFor="sprint-extend-end"
            >
              New end time
            </label>

            <input
              id="sprint-extend-end"
              className="sprint-complete__time"
              type="time"
              value={endTime}
              onChange={changeEnd}
            />

            {error && (
              <p className="sprint-complete__error" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className="sprint-complete__button"
              onClick={extendToChosen}
            >
              Extend sprint
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SprintCompleteModal
