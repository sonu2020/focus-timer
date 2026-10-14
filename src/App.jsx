import { useEffect, useRef, useState } from 'react'
import './App.css'
import Header from './Header'
import HomePage from './HomePage'
import HourlyTimeline from './HourlyTimeline'
import SprintCompleteModal from './SprintCompleteModal'
import SprintModal from './SprintModal'
import TeamModal from './TeamModal'
import {
  useTeamRoom,
  readIdentity,
  saveIdentity,
  clearIdentity,
  readInviteTeam,
} from './useTeamRoom'
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
  // Resume the timeline only while the saved sprint is running;
  // otherwise (no sprint, hasn't started yet, or already over) show the home page
  const [viewMode, setViewMode] = useState(() =>
    isSprintActive(readSavedSprint()) ? 'timeline' : 'home',
  )
  const [scrollLocked, setScrollLocked] = useState(true)
  const [aboutVisible, setAboutVisible] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  // Start from the saved settings when there are any
  const [localSprintConfig, setLocalSprintConfig] = useState(
    () => readSavedSprint() ?? DEFAULT_SPRINT,
  )
  const [localTodos, setLocalTodos] = useState(readSavedTodos)
  const [todosOpen, setTodosOpen] = useState(false)
  const [sprintEnded, setSprintEnded] = useState(false)
  const [identity, setIdentity] = useState(readIdentity)
  const [teamOpen, setTeamOpen] = useState(false)

  // Auto-open the Team modal if the visitor arrived via an invite link
  const [inviteTeam, setInviteTeam] = useState('')
  useEffect(() => {
    const team = readInviteTeam()
    if (team) {
      setInviteTeam(team)
      setTeamOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('team')
      url.searchParams.delete('join')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Sharing details are handled separately; the rest becomes the sprint config
    const { share, teamId: formTeamId, email: formEmail, ...sprintFields } = form
    const next = { ...DEFAULT_SPRINT, ...sprintFields }
    const willShare = share && formTeamId && formEmail

    setLocalSprintConfig(next)

    if (willShare) {
      const nextIdentity = { email: formEmail.trim(), teamId: formTeamId.trim() }
      saveIdentity(nextIdentity)
      // Hand the sprint to the team as soon as the socket is open
      pendingConfigRef.current = next
      setIdentity(nextIdentity)
    } else {
      if (inTeam) {
        clearIdentity()
        setIdentity(null)
      }

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

  function saveTeam(next) {
    saveIdentity(next)
    setIdentity(next)
    setTeamOpen(false)
  }

  function leaveTeam() {
    clearIdentity()
    setIdentity(null)
    setTeamOpen(false)
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
          onOpenTeam={() => setTeamOpen(true)}
          teamConnected={collab.status === 'online'}
          teamMemberCount={collab.members.length}
        />
      )}

      {viewMode === 'home' ? (
        <HomePage
          onStart={() => openModal('create')}
          onOpenTeam={() => setTeamOpen(true)}
          teamConnected={collab.status === 'online'}
          teamMemberCount={collab.members.length}
        />
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
          identity={identity}
          onClose={closeModal}
          onStart={confirmSprint}
        />
      )}

      {sprintEnded && (
        <SprintCompleteModal
          onDone={handleSprintDone}
          onExtend={handleSprintExtend}
          config={sprintConfig}
        />
      )}

      <TeamModal
        open={teamOpen}
        identity={identity}
        status={collab.status}
        members={collab.members}
        initialTeam={inviteTeam}
        onClose={() => {
          setTeamOpen(false)
          setInviteTeam('')
        }}
        onSave={saveTeam}
        onLeave={leaveTeam}
      />
    </div>
  )
}

export default App