import { useEffect, useRef, useState } from 'react'
import './App.css'

const labels = {
  pomodoro: 'Pomodoro',
  short: 'Short Break',
  long: 'Long Break',
}

const defaultMinutes = {
  pomodoro: 25,
  short: 5,
  long: 15,
}

function App() {
  const [durations, setDurations] = useState(defaultMinutes)
  const [draftDurations, setDraftDurations] = useState(defaultMinutes)
  const [mode, setMode] = useState('pomodoro')
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  const endTime = useRef(null)

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((endTime.current - Date.now()) / 1000),
      )

      setSecondsLeft(remaining)

      if (remaining === 0) {
        setIsRunning(false)
        endTime.current = null

        if (mode === 'pomodoro') {
          const nextCount = completed + 1
          setCompleted(nextCount)

          const nextMode = nextCount % 4 === 0 ? 'long' : 'short'
          setMode(nextMode)
          setSecondsLeft(durations[nextMode] * 60)
        } else {
          setMode('pomodoro')
          setSecondsLeft(durations.pomodoro * 60)
        }
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isRunning, mode, completed, durations])

  function selectMode(nextMode) {
    setIsRunning(false)
    endTime.current = null
    setMode(nextMode)
    setSecondsLeft(durations[nextMode] * 60)
  }

  function toggleTimer() {
    if (isRunning) {
      setIsRunning(false)
      endTime.current = null
    } else {
      endTime.current = Date.now() + secondsLeft * 1000
      setIsRunning(true)
    }
  }

  function resetTimer() {
    setIsRunning(false)
    endTime.current = null
    setSecondsLeft(durations[mode] * 60)
  }

  function updateDraft(key, value) {
    setDraftDurations((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function saveSettings(event) {
    event.preventDefault()

    const updated = {}

    for (const key of Object.keys(labels)) {
      const minutes = Number(draftDurations[key])

      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
        alert('Choose a whole number from 1 to 180 minutes.')
        return
      }

      updated[key] = minutes
    }

    setIsRunning(false)
    endTime.current = null
    setDurations(updated)
    setDraftDurations(updated)
    setSecondsLeft(updated[mode] * 60)
    setShowSettings(false)
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  const totalSeconds = durations[mode] * 60
  const progress = secondsLeft / totalSeconds
  const radius = 110
  const circumference = 2 * Math.PI * radius

  return (
    <div className={`app ${mode}`}>
      <header className="header">
        <h1>Focus Timer</h1>

        <button
          className="settings-button"
          onClick={() => setShowSettings((open) => !open)}
          aria-expanded={showSettings}
        >
          ⚙ Settings
        </button>
      </header>

      <main className="content">
        {showSettings && (
          <form className="settings-panel" onSubmit={saveSettings}>
            <h2>Choose your time</h2>

            <div className="settings-fields">
              {Object.entries(labels).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    value={draftDurations[key]}
                    onChange={(event) =>
                      updateDraft(key, event.target.value)
                    }
                    required
                  />
                  <small>minutes</small>
                </label>
              ))}
            </div>

            <button className="save-button" type="submit">
              Save times
            </button>
          </form>
        )}

        <section className="timer-card">
          <div className="tabs" aria-label="Timer mode">
            {Object.entries(labels).map(([key, label]) => (
              <button
                key={key}
                className={mode === key ? 'tab active' : 'tab'}
                onClick={() => selectMode(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="timer-circle">
            <svg
              className="progress-ring"
              viewBox="0 0 240 240"
              aria-hidden="true"
            >
              <circle
                className="ring-background"
                cx="120"
                cy="120"
                r={radius}
              />

              <circle
                className="ring-progress"
                cx="120"
                cy="120"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>

            <div className="time" role="timer" aria-live="off">
              {minutes}:{seconds}
            </div>
          </div>

          <div className="controls">
            <button className="start-button" onClick={toggleTimer}>
              {isRunning ? 'PAUSE' : 'START'}
            </button>

            <button className="reset-button" onClick={resetTimer}>
              Reset
            </button>
          </div>
        </section>

        <p className="session-count">
          Completed focus sessions: {completed}
        </p>

        <p className="message">
          {mode === 'pomodoro'
            ? 'Time to focus!'
            : 'Take a break—you earned it.'}
        </p>
      </main>
    </div>
  )
}

export default App