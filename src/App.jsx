import { useEffect, useRef, useState } from 'react'
import './App.css'
import TimelineView from './TimelineView'
import AmbienceMenu from './AmbienceMenu'
import { normalizeTimelineConfig } from './timelineConfig'

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

const TIMELINE_STORAGE_KEY = 'focus-timer.timeline-config'

function readTimelineConfig() {
  try {
    return normalizeTimelineConfig(
      JSON.parse(localStorage.getItem(TIMELINE_STORAGE_KEY)),
    )
  } catch {
    return normalizeTimelineConfig(null)
  }
}

function App() {
  const [durations, setDurations] = useState(defaultMinutes)
  const [draftDurations, setDraftDurations] = useState(defaultMinutes)
  const [mode, setMode] = useState('pomodoro')
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [viewMode, setViewMode] = useState('timer')
  const [timelineConfig, setTimelineConfig] = useState(readTimelineConfig)
  const [scrollLocked, setScrollLocked] = useState(true)
  const [aboutVisible, setAboutVisible] = useState(false)

  const endTime = useRef(null)

  useEffect(() => {
    const root = document.documentElement

    if (scrollLocked) {
      root.style.overflowY = 'hidden'
      return
    }

    root.style.overflowY = ''
    const frame = requestAnimationFrame(() => {
      document
        .getElementById('about')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => cancelAnimationFrame(frame)
  }, [scrollLocked])

  useEffect(() => {
    const about = document.getElementById('about')
    if (!about || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        setAboutVisible(entry.isIntersecting)
      }
    })

    observer.observe(about)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        TIMELINE_STORAGE_KEY,
        JSON.stringify(timelineConfig),
      )
    } catch {
      return
    }
  }, [timelineConfig])

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((endTime.current - Date.now()) / 1000),
      )

      setSecondsLeft(remaining)
      if (remaining === 0) {
        clearInterval(interval)
        setIsRunning(false)
        endTime.current = null

        alert(
          mode === 'pomodoro'
            ? 'Focus session finished! Time for a break.'
            : 'Break finished! Ready to focus again?',
        )

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

  function toggleViewMode() {
    setViewMode((current) => (current === 'timer' ? 'timeline' : 'timer'))
  }

  function goToAbout(event) {
    event.preventDefault()
    setScrollLocked(false)
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  const totalSeconds = durations[mode] * 60
  const progress = secondsLeft / totalSeconds
  const radius = 110
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className={`app ${mode}${viewMode === 'timeline' ? ' timeline-mode' : ''}`}
    >
      <section className="landing">
        <header className="header">
          <h1>Focus Timer</h1>

          <div className="header-actions">
            <AmbienceMenu />

            <button
              className="settings-button mode-button"
              onClick={toggleViewMode}
              title="Switch between Timer and Timeline / Ambient views"
            >
              ⇄ Switch Mode
            </button>

            <button
              className="settings-button"
              onClick={() => setShowSettings((open) => !open)}
              aria-expanded={showSettings}
            >
              ⚙ Settings
            </button>
          </div>
        </header>

        <main
          className={`content${viewMode === 'timeline' ? ' content--timeline' : ''}`}
        >
          {showSettings && (
            <form className="settings-panel" onSubmit={saveSettings}>
              <h4>Choose your time</h4>

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
                      onChange={(event) => updateDraft(key, event.target.value)}
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

          {viewMode === 'timer' ? (
            <div className="view" key="timer">
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
            </div>
          ) : (
            <div className="view timeline-view" key="timeline">
              <TimelineView
                config={timelineConfig}
                onChange={setTimelineConfig}
              />
            </div>
          )}
        </main>

        {viewMode !== 'timeline' && (
          <footer className={`footer${aboutVisible ? ' footer--hidden' : ''}`}>
            <nav className="footer-links" aria-label="Footer">
              <a className="footer-link" href="#about" onClick={goToAbout}>
                About
              </a>
            </nav>
          </footer>
        )}
      </section>

      {viewMode !== 'timeline' && (
        <section className="about" id="about">
        <h2 className="about-title">About</h2>

        <p className="about-intro">
          Focus Timer is a small, browser-based Pomodoro companion. Pick a tab,
          press start, and let the ring carry you through the session—no
          accounts, no dashboards, no clutter.
        </p>

        <div className="about-grid">
          <article className="about-item">
            <h3>Timer &amp; timeline</h3>
            <p>
              Use <strong>Settings</strong> to choose your own Pomodoro, short
              break and long break lengths. <strong>Switch Mode</strong> flips
              the same day between the classic countdown and a timeline view
              that shows how much of your day is already spent.
            </p>
          </article>

          <article className="about-item">
            <h3>Ambience</h3>
            <p>
              The <strong>♫</strong> menu beside Switch Mode plays background
              sound while you work: rain, ocean, forest, brown and pink noise,
              plus a slow focus pad for deep work. Every sound is generated
              live in your browser with the Web Audio API, so nothing is
              downloaded and nothing leaves your device.
            </p>
          </article>

          <article className="about-item">
            <h3>Storage</h3>
            <p>
              Your timer lengths and timeline settings are saved locally in
              this browser, and stay there until you change them.
            </p>
          </article>
        </div>
        </section>
      )}
    </div>
  )
}

export default App