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
  readActiveTeam,
  markTeamActive,
  generateTeamId,
  writeTeamCache,
} from './useTeamRoom'
import { getSprintLink, readSharedSprint } from './sprintShare'
import { readSession, writeSession } from './storage'
import { hasSprintStarted } from './time'
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

// Where the visitor's chosen times are kept for the current browsing session
const SPRINT_STORAGE_KEY = 'focus-timer.sprint-config'

// Where the visitor's tasks are kept for the current browsing session
const TODOS_STORAGE_KEY = 'focus-timer.todos'

// Which view (home/timeline) the current browsing session is showing, so a
// reload lands back on it while a fresh visit always starts at home
const VIEW_STORAGE_KEY = 'focus-timer.view-mode'

// Returns this session's tasks, or an empty list for a fresh visit
function readSavedTodos() {
  const saved = readSession(TODOS_STORAGE_KEY, [])

  return Array.isArray(saved) ? saved : []
}

// Returns this session's sprint settings, or null for a fresh visit
function readSavedSprint() {
  const saved = readSession(SPRINT_STORAGE_KEY)

  if (
    !saved ||
    !Number.isInteger(saved.startHour) ||
    !Number.isInteger(saved.endHour)
  ) {
    return null
  }

  return { ...DEFAULT_SPRINT, ...saved }
}

// Remembers the sprint settings for the rest of this browsing session
function saveSprintConfig(config) {
  writeSession(SPRINT_STORAGE_KEY, config)
}

function App() {
  const [mode, setMode] = useState('pomodoro')
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  // A sprint carried in the URL (?sprint=...) is loaded on first render
  const [sharedSprint] = useState(readSharedSprint)
  const [incomingTeam] = useState(readInviteTeam)
  // A shared link opens the timeline only once its start time has arrived.
  // Otherwise the view is restored from this session, so a reload keeps it but
  // a fresh visit always starts at home.
  const [viewMode, setViewMode] = useState(() => {
    if (sharedSprint) {
      return hasSprintStarted(sharedSprint) ? 'timeline' : 'home'
    }

    if (incomingTeam) return 'home'
    if (readSession(VIEW_STORAGE_KEY) !== 'timeline') return 'home'

    const savedSprint = readSavedSprint()
    return savedSprint && hasSprintStarted(savedSprint) ? 'timeline' : 'home'
  })
  const [scrollLocked, setScrollLocked] = useState(true)
  const [aboutVisible, setAboutVisible] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const draftTeamIdRef = useRef(null)
  // Settings used to prefill the sprint modal: the shared sprint, then the
  // saved one, then the defaults. A shared link never inherits another tab's
  // sprint or task state.
  const [localSprintConfig, setLocalSprintConfig] = useState(() =>
    sharedSprint ??
    (incomingTeam ? DEFAULT_SPRINT : (readSavedSprint() ?? DEFAULT_SPRINT)),
  )
  const [localTodos, setLocalTodos] = useState(() =>
    incomingTeam ? [] : readSavedTodos(),
  )
  const [todosOpen, setTodosOpen] = useState(false)
  const [sprintEnded, setSprintEnded] = useState(false)
  const [identity, setIdentity] = useState(() => {
    // A visitor arriving through a team invite link joins that team on first load
    const saved = readIdentity()

    if (!incomingTeam || saved?.teamId === incomingTeam) return saved

    const nextIdentity = { teamId: incomingTeam }
    saveIdentity(nextIdentity)
    return nextIdentity
  })

  // A team is only "live" for the session that joined or created it. A teamId
  // left in localStorage by an earlier visit stays dormant until this visitor
  // rejoins through an invite link, or offers a fresh invite of their own.
  const [teamActive, setTeamActive] = useState(() => {
    if (!identity) return false
    if (incomingTeam && incomingTeam === identity.teamId) return true

    return readActiveTeam() === identity.teamId
  })

  // Persist the joined room for this session so a refresh keeps it live
  useEffect(() => {
    if (incomingTeam && incomingTeam === identity?.teamId) {
      markTeamActive(incomingTeam)
    }
  }, [incomingTeam, identity?.teamId])

  const inTeam = Boolean(identity) && teamActive

  // Persist a sprint opened from a link so a refresh keeps it
  useEffect(() => {
    if (sharedSprint) saveSprintConfig(sharedSprint)
  }, [sharedSprint])

  // A shared link starts from its own state, never tasks or a sprint left
  // behind in this tab
  useEffect(() => {
    if (!incomingTeam) return

    writeSession(TODOS_STORAGE_KEY, [])

    if (!sharedSprint) {
      writeSession(SPRINT_STORAGE_KEY, null)
    }
  }, [incomingTeam, sharedSprint])

  // Keep this session's view so a reload returns to it; closing the tab clears it
  useEffect(() => {
    writeSession(VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  // A shared link opened early waits for its start time, then opens itself
  useEffect(() => {
    if (!sharedSprint || viewMode !== 'home') return

    const now = new Date()
    const start = new Date(now)
    start.setHours(sharedSprint.startHour, sharedSprint.startMinute, 0, 0)

    const delay = start.getTime() - now.getTime()
    if (!Number.isFinite(delay) || delay <= 0) return

    const timer = setTimeout(() => {
      if (hasSprintStarted(sharedSprint)) setViewMode('timeline')
    }, delay)

    return () => clearTimeout(timer)
  }, [sharedSprint, viewMode])

  // Drop the share params from the address bar once they've been handled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('team') && !params.has('sprint')) return

    params.delete('team')
    params.delete('sprint')

    const query = params.toString()
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
    )
  }, [])

  // When part of a live team, the team's room holds the shared tasks and
  // settings; otherwise everything stays local to this browser.
  const collab = useTeamRoom({
    teamId: identity?.teamId,
    enabled: inTeam,
  })

  const todos = inTeam ? collab.todos : localTodos
  const setTodos = inTeam ? collab.setTodos : setLocalTodos
  const sprintConfig =
    inTeam && collab.config ? collab.config : localSprintConfig

  const endTime = useRef(null)
  // A sprint config waiting to be pushed to the team once the socket connects
  const pendingConfigRef = useRef(null)
  // Rooms this browser has already seeded, so we only push local tasks once
  const seededRoomsRef = useRef(new Set())
  const {
    status: teamStatus,
    hasState: teamHasState,
    setConfig: setTeamConfig,
    setTodos: setTeamTodos,
  } = collab

  // Once the team socket is open, hand it the sprint the visitor just shared
  useEffect(() => {
    if (inTeam && teamStatus === 'online' && pendingConfigRef.current) {
      setTeamConfig(pendingConfigRef.current)
      pendingConfigRef.current = null
    }
  }, [inTeam, teamStatus, setTeamConfig])

  // The creator's local tasks (and a joiner's, when the room is still empty)
  // become the room's starting point so everyone sees them
  useEffect(() => {
    const teamId = identity?.teamId

    if (!inTeam || !teamId || !teamHasState) return
    if (seededRoomsRef.current.has(teamId)) return

    seededRoomsRef.current.add(teamId)

    if (collab.todos.length === 0 && localTodos.length > 0) {
      setTeamTodos(localTodos)
    }
  }, [
    inTeam,
    identity?.teamId,
    teamHasState,
    collab.todos,
    localTodos,
    setTeamTodos,
  ])

  // keep the session's tasks so a refresh doesn't lose them (cleared on close)
  useEffect(() => {
    if (!inTeam) writeSession(TODOS_STORAGE_KEY, localTodos)
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
    draftTeamIdRef.current =
      nextModalMode === 'create' ? generateTeamId() : null
    setIsModalOpen(true)
  }

  function closeModal() {
    draftTeamIdRef.current = null
    setIsModalOpen(false)
  }

  // Turns a solo visitor into a shared room the moment they offer to invite
  // someone, so the link they copy carries a room everyone can join. A new
  // sprint always gets its own room; an existing sprint reuses its current one.
  function enableInvite() {
    let teamId = identity?.teamId

    if (modalMode === 'create') {
      if (!draftTeamIdRef.current) {
        draftTeamIdRef.current = generateTeamId()
      }
      teamId = draftTeamIdRef.current
    } else if (!teamId) {
      teamId = generateTeamId()
    }

    if (identity?.teamId === teamId) {
      // Re-activate a room this browser already belongs to
      markTeamActive(teamId)
      setTeamActive(true)
      return teamId
    }

    const nextIdentity = { teamId }

    // Seed the room's cache with the tasks and sprint we already have
    writeTeamCache(teamId, { todos: localTodos, config: localSprintConfig })
    saveIdentity(nextIdentity)
    markTeamActive(teamId)
    setIdentity(nextIdentity)
    setTeamActive(true)

    return teamId
  }

  // Builds the shareable link, tied to the sprint's own room
  function getShareLink(
    config,
    teamId = draftTeamIdRef.current ?? identity?.teamId,
  ) {
    return getSprintLink(config, teamId)
  }

  // Saves the chosen settings; the timeline then follows the chosen clock times
  function confirmSprint(form) {
    requestNotificationPermission()

    const next = { ...DEFAULT_SPRINT, ...form }
    if (!hasSprintStarted(next)) return

    const isNewSprint = modalMode === 'create'
    let nextInTeam = inTeam

    // Every new sprint is bound to a fresh room. If it was shared from the
    // modal that room is already live; otherwise keep it dormant until shared.
    if (isNewSprint) {
      const teamId = draftTeamIdRef.current ?? generateTeamId()
      draftTeamIdRef.current = null

      if (identity?.teamId === teamId) {
        nextInTeam = teamActive
      } else {
        const nextIdentity = { teamId }
        writeTeamCache(teamId, { todos: [], config: next })
        saveIdentity(nextIdentity)
        markTeamActive('')
        setIdentity(nextIdentity)
        setTeamActive(false)
        nextInTeam = false
      }
    }

    setLocalSprintConfig(next)

    // A brand-new sprint starts with a clean task list
    if (isNewSprint) {
      setLocalTodos([])
      writeSession(TODOS_STORAGE_KEY, [])

      if (nextInTeam) setTeamTodos([])
    }

    if (nextInTeam) {
      // Store the shared sprint right away; queue a resend if the socket is down
      setTeamConfig(next)

      if (teamStatus !== 'online') {
        pendingConfigRef.current = next
      }
    } else {
      saveSprintConfig(next)
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
    // Wrapping up clears the tasks so the next sprint starts fresh
    setLocalTodos([])
    writeSession(TODOS_STORAGE_KEY, [])
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
      setTeamConfig(next)
    } else {
      setLocalSprintConfig(next)
      saveSprintConfig(next)
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
          collaborating={inTeam}
          teamStatus={teamStatus}
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
          onGetInviteLink={getShareLink}
          onEnableInvite={enableInvite}
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