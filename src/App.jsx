import { useEffect, useRef, useState } from 'react'
import './App.css'
import Header from './Header'
import HomePage from './HomePage'
import HourlyTimeline from './HourlyTimeline'
import SprintCompleteModal from './SprintCompleteModal'
import SprintModal from './SprintModal'
import {
  useTeamRoom,
  readIdentity,
  saveIdentity,
  readInviteTeam,
} from './useTeamRoom'
import { getSprintLink, readSharedSprint } from './sprintShare'
import { requestNotificationPermission, unlockBlockAudio } from './blockAlerts'

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

const DEFAULT_SPRINT = {
  startHour: 9,
  startMinute: 0,
  endHour: 19,
  endMinute: 0,
  length: '10',
  blockCount: 10,
  theme: '#52d696',
}

// Where the visitor's chosen times are saved in their browser
const SPRINT_STORAGE_KEY = 'focus-timer.sprint-config'

// Where the visitor's tasks are saved in their browser
const TODOS_STORAGE_KEY = 'focus-timer.todos'

// Returns the saved tasks, or an empty list for a first-time visitor
function readSavedTodos() {
  try {
    const saved = JSON.parse(localStorage.getItem(TODOS_STORAGE_KEY))

    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

// Returns the saved sprint settings, or null for a first-time visitor
function readSavedSprint() {
  try {
    const saved = JSON.parse(localStorage.getItem(SPRINT_STORAGE_KEY))

    if (
      !saved ||
      !Number.isInteger(saved.startHour) ||
      !Number.isInteger(saved.endHour)
    ) {
      return null
    }

    return { ...DEFAULT_SPRINT, ...saved }
  } catch {
    return null
  }
}

function isSprintActive(sprint) {
  if (!sprint) return false

  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const start = sprint.startHour * 60
  const end = sprint.endHour * 60

  if (end === start) return true
  if (end > start) return minutes >= start && minutes < end

  return minutes >= start || minutes < end
}

function App() {
  const [mode, setMode] = useState('pomodoro')
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  // A sprint carried in the URL (?sprint=...) opens straight away
  const [sharedSprint] = useState(readSharedSprint)
  const [incomingTeam] = useState(readInviteTeam)
  // Resume the timeline only while the saved sprint is running;
  // otherwise (no sprint, hasn't started yet, or already over) show the home page
  const [viewMode, setViewMode] = useState(() =>
    sharedSprint || isSprintActive(readSavedSprint()) ? 'timeline' : 'home',
  )
  const [scrollLocked, setScrollLocked] = useState(true)
  const [aboutVisible, setAboutVisible] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  // Start from a shared sprint, then the saved settings, then the defaults
  const [localSprintConfig, setLocalSprintConfig] = useState(
    () => sharedSprint ?? readSavedSprint() ?? DEFAULT_SPRINT,
  )
  const [localTodos, setLocalTodos] = useState(readSavedTodos)
  const [todosOpen, setTodosOpen] = useState(false)
  const [sprintEnded, setSprintEnded] = useState(false)
  const [identity] = useState(() => {
    // A visitor arriving through a team invite link joins that team on first load
    const saved = readIdentity()

    if (!incomingTeam || saved?.teamId === incomingTeam) return saved

    const nextIdentity = { email: saved?.email ?? '', teamId: incomingTeam }
    saveIdentity(nextIdentity)
    return nextIdentity
  })

  // Persist a sprint opened from a link so a refresh keeps it
  useEffect(() => {
    if (!sharedSprint) return

    try {
      localStorage.setItem(SPRINT_STORAGE_KEY, JSON.stringify(sharedSprint))
    } catch {
      // storage unavailable, the sprint just won't be remembered
    }
  }, [sharedSprint])

  // Drop the share params from the address bar once they've been handled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('team') && !params.has('join') && !params.has('sprint')) return

    params.delete('team')
    params.delete('join')
    params.delete('sprint')

    const query = params.toString()
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
    )
  }, [])

  // When part of a team, the team's room holds the shared tasks and settings;
  // otherwise everything stays local to this browser.
  const collab = useTeamRoom({
    teamId: identity?.teamId,
    email: identity?.email,
    enabled: Boolean(identity),
  })

  const inTeam = Boolean(identity)
  const todos = inTeam ? collab.todos : localTodos
  const setTodos = inTeam ? collab.setTodos : setLocalTodos
  const sprintConfig =
    inTeam && collab.config ? collab.config : localSprintConfig

  const endTime = useRef(null)
  // A sprint config waiting to be pushed to the team once the socket connects
  const pendingConfigRef = useRef(null)
  const { status: teamStatus, setConfig: setTeamConfig } = collab

  // Once the team socket is open, hand it the sprint the visitor just shared
  useEffect(() => {
    if (inTeam && teamStatus === 'online' && pendingConfigRef.current) {
      setTeamConfig(pendingConfigRef.current)
      pendingConfigRef.current = null
    }
  }, [inTeam, teamStatus, setTeamConfig])

  // keep the tasks in the browser so a refresh doesn't lose them
  useEffect(() => {
    if (inTeam) return

    try {
      localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(localTodos))
    } catch {
      // storage unavailable, the tasks just won't be remembered
    }
  }, [localTodos, inTeam])

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

  // the first interaction unlocks audio so the block-end chime can play later
  useEffect(() => {
    const unlock = () => unlockBlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

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

  function openModal(nextModalMode = 'create') {
    setModalMode(nextModalMode)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
  }

   // Saves the chosen settings; the timeline then follows the chosen clock times
  function confirmSprint(form) {
    requestNotificationPermission()

    const next = { ...DEFAULT_SPRINT, ...form }
    setLocalSprintConfig(next)

    if (inTeam) {
      // Store the shared sprint right away; queue a resend if the socket is down
      setTeamConfig(next)

      if (teamStatus !== 'online') {
        pendingConfigRef.current = next
      }
    } else {
      try {
        localStorage.setItem(SPRINT_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // storage unavailable, the settings just won't be remembered
      }
    }

    setIsModalOpen(false)
    setSprintEnded(false)
    setTodosOpen(false)
    setViewMode('timeline')
  }

  // when the sprint's time window is over, ask the visitor to wrap up
  function handleSprintEnd() {
    setTodosOpen(false)
    setSprintEnded(true)
  }

  function handleSprintDone() {
    setSprintEnded(false)
    setViewMode('home')
  }

  // Extend the sprint's end time without losing the elapsed time or the tasks
  function handleSprintExtend(end) {
    const next = {
      ...sprintConfig,
      endHour: end.endHour,
      endMinute: end.endMinute,
    }

    if (inTeam) {
      collab.setConfig(next)
    } else {
      setLocalSprintConfig(next)

      try {
        localStorage.setItem(SPRINT_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // storage unavailable, the settings just won't be remembered
      }
    }

    setSprintEnded(false)
    setViewMode('timeline')
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
      {viewMode !== 'home' && (
        <Header
          onStart={() => openModal('update')}
          todoOpen={todosOpen}
          todoCount={todos.filter((todo) => !todo.done).length}
          onToggleTodos={() => setTodosOpen((open) => !open)}
        />
      )}

      {viewMode === 'home' ? (
        <HomePage onStart={() => openModal('create')} />
      ) : (
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
                <HourlyTimeline
                  config={sprintConfig}
                  todos={todos}
                  setTodos={setTodos}
                  todosOpen={todosOpen}
                  setTodosOpen={setTodosOpen}
                  onSprintEnd={handleSprintEnd}
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
      )}

      {viewMode !== 'timeline' && viewMode !== 'home' && (
        <section className="about" id="about">
          <h2 className="about-title">About</h2>

          <p className="about-intro">
            Focus Timer is a small, browser-based Pomodoro companion. Pick a
            tab, press start, and let the ring carry you through the
            session—no accounts, no dashboards, no clutter.
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

      {/* Only mounted while open, so it always starts with the latest saved values */}
      {isModalOpen && (
        <SprintModal
          open
          mode={modalMode}
          initial={sprintConfig}
          onClose={closeModal}
          onStart={confirmSprint}
          onGetInviteLink={getSprintLink}
        />
      )}

      {sprintEnded && (
        <SprintCompleteModal
          onDone={handleSprintDone}
          onExtend={handleSprintExtend}
          config={sprintConfig}
        />
      )}
    </div>
  )
}

export default App