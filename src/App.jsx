import { useEffect, useRef, useState } from 'react'
import './App.css'
import Header from './Header'
import TimelineView from './TimelineView'
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
  const [mode, setMode] = useState('pomodoro')
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [viewMode, setViewMode] = useState('timeline')
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
          setSecondsLeft(defaultMinutes[nextMode] * 60)
        } else {
          setMode('pomodoro')
          setSecondsLeft(defaultMinutes.pomodoro * 60)
        }
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isRunning, mode, completed])

  function selectMode(nextMode) {
    setIsRunning(false)
    endTime.current = null
    setMode(nextMode)
    setSecondsLeft(defaultMinutes[nextMode] * 60)
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
    setSecondsLeft(defaultMinutes[mode] * 60)
  }

  function startSprint() {
    setViewMode('timer')
    setMode('pomodoro')
    setSecondsLeft(defaultMinutes.pomodoro * 60)
    endTime.current = Date.now() + defaultMinutes.pomodoro * 60 * 1000
    setIsRunning(true)
  }

  function goToAbout(event) {
    event.preventDefault()
    setScrollLocked(false)
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  const totalSeconds = defaultMinutes[mode] * 60
  const progress = secondsLeft / totalSeconds
  const radius = 110
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className={`app ${mode}${viewMode === 'timeline' ? ' timeline-mode' : ''}`}
    >
      <Header onStart={startSprint} />

      <section className="landing">
        <main
          className={`content${viewMode === 'timeline' ? ' content--timeline' : ''}`}
        >
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
              Hit <strong>Start a Sprint</strong> in the header to kick off a
              Pomodoro focus session, then flow through short and long breaks
              automatically. Switch between the classic countdown and a
              timeline view that shows how much of your day is already spent.
            </p>
          </article>

          <article className="about-item">
            <h3>Storage</h3>
            <p>
              Your timeline settings are saved locally in this browser, and
              stay there until you change them.
            </p>
          </article>
        </div>
        </section>
      )}
    </div>
  )
}

export default App