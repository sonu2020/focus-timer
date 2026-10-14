import { useEffect, useState } from 'react'
import './SprintModal.css'

const BLOCK_PRESETS = [3, 5, 10]

const CUSTOM_BLOCK_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1)

const THEMES = [
  { name: 'Green', value: '#52d696', border: '#2E7D56' },
  { name: 'Orange', value: '#f59e0b', border: '#C76A13' },
  { name: 'Red', value: '#ef4444', border: '#C0392B' },
  { name: 'Purple', value: '#8b5cf6', border: '#6C5CE7' },
  { name: 'Dark Gray', value: '#374151', border: '#2C3A47' },
  { name: 'Blue', value: '#3b82f6', border: '#1d4ed8' },
  { name: 'Yellow', value: '#facc15', border: '#b45309' },
  { name: 'Pink', value: '#ec4899', border: '#be185d' },
]

// (9, 0) -> "09:00"  (the format a time input uses)
function toTimeValue(hour24, minute = 0) {
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// "10:14" -> { hour: 10, minute: 14 }, or null while the field is empty/incomplete
function parseTime(value) {
  if (!value) return null

  const [h, m] = String(value).split(':')
  const hour = Number.parseInt(h, 10)
  const minute = Number.parseInt(m, 10)

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null

  return { hour, minute }
}

function Caret() {
  return (
    <svg className="sprint-modal__caret" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Open the browser's time picker when the field is clicked
function openPicker(event) {
  try {
    event.currentTarget.showPicker()
  } catch {
    // showPicker is not supported or not allowed here; typing still works
  }
}

function SprintModal({ open, mode = 'create', initial, onClose, onStart }) {
  const isUpdate = mode === 'update'

  const [startTime, setStartTime] = useState(
    initial?.startTime ?? toTimeValue(initial?.startHour ?? 9, initial?.startMinute ?? 0),
  )
  const [endTime, setEndTime] = useState(
    initial?.endTime ?? toTimeValue(initial?.endHour ?? 19, initial?.endMinute ?? 0),
  )
  const [error, setError] = useState('')
  const [length, setLength] = useState(initial?.length ?? '10')
  const [customBlocks, setCustomBlocks] = useState(
    initial?.length === 'Customize' ? (initial.blockCount ?? 6) : 6,
  )
  const [theme, setTheme] = useState(initial?.themeName ?? 'Green')

  const blockCount = length === 'Customize' ? customBlocks : Number(length)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  function changeStart(event) {
    setStartTime(event.target.value)
    setError('')
  }

  function changeEnd(event) {
    setEndTime(event.target.value)
    setError('')
  }

  function handleStart() {
    const start = parseTime(startTime)
    const end = parseTime(endTime)

    if (!start || !end) {
      setError('Please enter both a start and an end time.')
      return
    }

    if (end.hour * 60 + end.minute <= start.hour * 60 + start.minute) {
      setError('The end time must be after the start time.')
      return
    }

    const selected = THEMES.find((item) => item.name === theme)

    onStart({
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
      startTime,
      endTime,
      length,
      blockCount,
      themeName: theme,
      theme: selected ? selected.value : '#52d696',
    })
  }

  if (!open) return null

  return (
    <div className="sprint-modal" role="presentation" onClick={onClose}>
      <div
        className="sprint-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sprint-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="sprint-modal__close"
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <h2 id="sprint-modal-title" className="sprint-modal__title">
          {isUpdate ? 'Update your sprint' : 'Create a Sprint'}
        </h2>

        <div className="sprint-modal__field">
          <label className="sprint-modal__label" htmlFor="sprint-start">
            When does your day start?
          </label>
          <input
            id="sprint-start"
            className="sprint-modal__time"
            type="time"
            value={startTime}
            onChange={changeStart}
            onClick={openPicker}
            required
          />
        </div>

        <div className="sprint-modal__field">
          <label className="sprint-modal__label" htmlFor="sprint-end">
            When does your day end?
          </label>
          <input
            id="sprint-end"
            className="sprint-modal__time"
            type="time"
            value={endTime}
            onChange={changeEnd}
            onClick={openPicker}
            required
          />
        </div>

        <p className="sprint-modal__hint">
          Click the field or type a time, like 10:14.
        </p>

        {error && (
          <p className="sprint-modal__error" role="alert">
            {error}
          </p>
        )}

        <div className="sprint-modal__field">
          <span className="sprint-modal__label">How long is the sprint?</span>
          <div className="sprint-modal__segments" role="group">
            {BLOCK_PRESETS.map((option) => (
              <button
                key={option}
                type="button"
                className={`sprint-modal__segment${
                  length === String(option) ? ' sprint-modal__segment--active' : ''
                }`}
                onClick={() => setLength(String(option))}
              >
                {option}
              </button>
            ))}

            <select
              className={`sprint-modal__segment sprint-modal__segment--select${
                length === 'Customize' ? ' sprint-modal__segment--active' : ''
              }`}
              value={length === 'Customize' ? String(customBlocks) : ''}
              onChange={(event) => {
                setLength('Customize')
                setCustomBlocks(Number(event.target.value))
              }}
              aria-label="Custom block count"
            >
              <option value="" disabled>
                Customize
              </option>

              {CUSTOM_BLOCK_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sprint-modal__field">
          <span className="sprint-modal__label">Choose your sprint theme</span>
          <div className="sprint-modal__swatches" role="group">
            {THEMES.map((item) => (
              <button
                key={item.name}
                type="button"
                className={`sprint-modal__swatch${
                  theme === item.name ? ' sprint-modal__swatch--active' : ''
                }`}
                style={{ '--swatch': item.value, '--swatch-border': item.border }}
                onClick={() => setTheme(item.name)}
                aria-label={item.name}
                aria-pressed={theme === item.name}
                title={item.name}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="sprint-modal__submit"
          onClick={handleStart}
        >
          {isUpdate ? 'Save Changes' : 'Start Now'}
          <Caret />
        </button>
      </div>
    </div>
  )
}

export default SprintModal