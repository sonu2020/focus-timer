import { useEffect, useState } from 'react'
import './SprintModal.css'

const LENGTHS = ['Small', 'Medium', 'Large', 'Customize']

const THEMES = [
  { name: 'Green', value: '#52d696' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Dark Gray', value: '#374151' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Yellow', value: '#facc15' },
  { name: 'Pink', value: '#ec4899' },
]

function formatHour(hour24) {
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return `${String(hour12).padStart(2, '0')}:00 ${suffix}`
}

const TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: formatHour(hour),
}))

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

function SprintModal({ open, onClose, onStart }) {
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(19)
  const [length, setLength] = useState('Medium')
  const [theme, setTheme] = useState('Green')

  useEffect(() => {
    if (!open) return

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  function handleStart() {
    const selected = THEMES.find((item) => item.name === theme)

    onStart({
      startHour,
      endHour,
      length,
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
          Create a Sprint
        </h2>

        <div className="sprint-modal__field">
          <label className="sprint-modal__label" htmlFor="sprint-start">
            When does your day start?
          </label>
          <select
            id="sprint-start"
            className="sprint-modal__select"
            value={startHour}
            onChange={(event) => setStartHour(Number(event.target.value))}
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sprint-modal__field">
          <label className="sprint-modal__label" htmlFor="sprint-end">
            When does your day end?
          </label>
          <select
            id="sprint-end"
            className="sprint-modal__select"
            value={endHour}
            onChange={(event) => setEndHour(Number(event.target.value))}
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sprint-modal__field">
          <span className="sprint-modal__label">How long is the sprint?</span>
          <div className="sprint-modal__segments" role="group">
            {LENGTHS.map((option) => (
              <button
                key={option}
                type="button"
                className={`sprint-modal__segment${
                  length === option ? ' sprint-modal__segment--active' : ''
                }`}
                onClick={() => setLength(option)}
              >
                {option}
                {option === 'Customize' && <Caret />}
              </button>
            ))}
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
                style={{ '--swatch': item.value }}
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
          Start Now
          <Caret />
        </button>
      </div>
    </div>
  )
}

export default SprintModal
