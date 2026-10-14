import { useEffect, useState } from 'react'
import './HourlyTimeline.css'
import CafePicker from './CafePicker'

const DAY_MINUTES = 1440

const COUNTDOWN_MINUTES = 5
const COUNTDOWN_CRITICAL_MINUTES = 2.5

// mm:ss, or h:mm:ss when an hour or more is left
function formatRemaining(minutesLeft) {
  const totalSeconds = Math.max(0, Math.ceil(minutesLeft * 60))
  const hours = Math.floor(totalSeconds / 3600)
  const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const secs = String(totalSeconds % 60).padStart(2, '0')

  return hours > 0 ? `${hours}:${mins}:${secs}` : `${mins}:${secs}`
}

function formatHour(hour24) {
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return {
    time: `${String(hour12).padStart(2, '0')}:00`,
    suffix,
  }
}

// minute of the day (0-1439) -> "10:14 AM"
function formatMinuteLabel(minuteOfDay) {
  const total =
    ((Math.round(minuteOfDay) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hour24 = Math.floor(total / 60)
  const minute = total % 60
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`
}

function formatTimeValue(value) {
  const [hour, minute] = value.split(':').map(Number)
  const suffix = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12

  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(
    2,
    '0',
  )} ${suffix}`
}

// minute of the day -> "HH:MM" (the format a time input uses)
function toTimeValue(minuteOfDay) {
  const total = ((minuteOfDay % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hour = Math.floor(total / 60)
  const minute = total % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function defaultEndMinutes(startMin, endMin) {
  if (endMin <= startMin) return (startMin + 60) % DAY_MINUTES

  return Math.min(startMin + 60, endMin)
}

function HourlyTimeline({ config }) {
  // Start and end chosen in the Create/Update Sprint modal
  const startMin = (config?.startHour ?? 9) * 60 + (config?.startMinute ?? 0)
  const endMin = (config?.endHour ?? 19) * 60 + (config?.endMinute ?? 0)
  const blockCount = Math.max(1, Number(config?.blockCount) || 10)
  const theme = config?.theme ?? '#52d696'

  // The countdown starts when the sprint was saved
  const [mountedAt] = useState(() => Date.now())
  const startedAt = config?.startedAt ?? mountedAt

  const [nowMs, setNowMs] = useState(() => Date.now())
  const [todosOpen, setTodosOpen] = useState(false)
  const [todos, setTodos] = useState([])
  const [draft, setDraft] = useState('')
  const [draftStart, setDraftStart] = useState(toTimeValue(startMin))
  const [draftEnd, setDraftEnd] = useState(() =>
    toTimeValue(defaultEndMinutes(startMin, endMin)),
  )
  const [range, setRange] = useState({ startMin, endMin })

  // When a new sprint time is chosen, reset the task time fields to match
  if (range.startMin !== startMin || range.endMin !== endMin) {
    setRange({ startMin, endMin })
    setDraftStart(toTimeValue(startMin))
    setDraftEnd(toTimeValue(defaultEndMinutes(startMin, endMin)))
  }

  const wraps = endMin <= startMin

  const timesValid = draftStart && draftEnd && (wraps || draftStart < draftEnd)

  function addTodo(event) {
    event.preventDefault()

    const text = draft.trim()
    if (!text || !timesValid) return

    setTodos((prev) => [
      ...prev,
      { id: Date.now(), text, done: false, start: draftStart, end: draftEnd },
    ])
    setDraft('')
  }

  function toggleTodo(id) {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    )
  }

  function removeTodo(id) {
    setTodos((prev) => prev.filter((todo) => todo.id !== id))
  }

  useEffect(() => {
    let frameId
    let lastPaint = 0

    function tick(time) {
      if (time - lastPaint >= 100) {
        setNowMs(Date.now())
        lastPaint = time
      }

      frameId = requestAnimationFrame(tick)
    }

    function refresh() {
      setNowMs(Date.now())
    }

    frameId = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  // Length of the sprint in minutes (end time minus start time)
  let span = (endMin - startMin + DAY_MINUTES) % DAY_MINUTES

  if (span === 0) span = DAY_MINUTES

  // Minutes since the sprint was saved (the stopwatch)
  const elapsed = Math.max(0, (nowMs - startedAt) / 60000)

  const finished = elapsed >= span
  const inRange = !finished
  const remainingMinutes = Math.max(0, span - elapsed)
  const nowPercent = inRange ? (elapsed / span) * 100 : 0
  const currentHour = new Date(nowMs).getHours()
  const current = formatHour(currentHour)

  const blockSpan = span / blockCount

  // Every block starts full and drains as time passes
  const blocks = Array.from({ length: blockCount }, (_, index) => {
    const used = Math.min(
      1,
      Math.max(0, (elapsed - index * blockSpan) / blockSpan),
    )

    return { index, remaining: 1 - used }
  })

  let countdown = null

  if (inRange) {
    const activeIndex = Math.min(
      blockCount - 1,
      Math.floor(elapsed / blockSpan),
    )
    const blockEnd = (activeIndex + 1) * blockSpan
    const remaining = blockEnd - elapsed

    if (remaining <= COUNTDOWN_MINUTES) {
      countdown = {
        text: formatRemaining(remaining),
        critical: remaining <= COUNTDOWN_CRITICAL_MINUTES,
      }
    }
  }

  // Tick marks at every whole hour inside the chosen window
  const ticks = []

  for (let offset = 1; offset < span; offset += 1) {
    const absolute = (startMin + offset) % DAY_MINUTES

    if (absolute % 60 === 0) {
      ticks.push({
        hour: absolute / 60,
        left: (offset / span) * 100,
      })
    }
  }

  return (
    <div className={`timeline-shell${todosOpen ? ' timeline-shell--open' : ''}`}>
      <section className="hourly-timeline" aria-label="Hourly timeline">
        <span className="hourly-timeline__edge hourly-timeline__edge--start">
          {formatMinuteLabel(startMin)}
        </span>

        <div className="hourly-timeline__axis">
          <div className="hourly-timeline__line" />

          {inRange && (
            <button
              type="button"
              className="hourly-timeline__now"
              style={{ left: `${nowPercent}%` }}
              onClick={() => setTodosOpen((open) => !open)}
              aria-label={`Current time ${current.time} ${current.suffix} — open to-do list`}
              aria-expanded={todosOpen}
            >
              <span className="hourly-timeline__now-plus" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 5v14M5 12h14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
          )}

          {ticks.map(({ hour, left }) => (
            <span
              key={hour}
              className="hourly-timeline__tick"
              style={{ left: `${left}%` }}
            >
              <span className="hourly-timeline__tick-label">
                {formatHour(hour).time}
              </span>
            </span>
          ))}
        </div>

        <span className="hourly-timeline__edge hourly-timeline__edge--end">
          {countdown && (
            <span
              className={`hourly-timeline__countdown${
                countdown.critical ? ' hourly-timeline__countdown--critical' : ''
              }`}
              role="timer"
              aria-label={`${countdown.text} left in this block`}
            >
              {countdown.text}
            </span>
          )}

          {formatMinuteLabel(endMin)}
        </span>

             <div className="hourly-timeline__grid">
          {blocks.map(({ index, remaining }) => (
            <div
              key={index}
              className="hourly-timeline__block hourly-timeline__block--drain"
            >
              <span
                className="hourly-timeline__fill"
                style={{
                  background: theme,
                  // cuts the colour away from the TOP, so the edge moves down
                  clipPath: `inset(${(1 - remaining) * 100}% 0 0 0)`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="hourly-timeline__status">
          <CafePicker />

          <span
            className="hourly-timeline__remaining"
            role="timer"
            aria-label="Time left in this sprint"
          >
            {finished ? 'Done' : formatRemaining(remainingMinutes)}
          </span>
        </div>
      </section>

      {todos.length > 0 && (
        <aside className="timeline-tasks" aria-label="Scheduled tasks">
          <ul className="timeline-tasks__list">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className={`timeline-tasks__item${
                  todo.done ? ' timeline-tasks__item--done' : ''
                }`}
              >
                <span className="timeline-tasks__title">{todo.text}</span>
                <span className="timeline-tasks__time">
                  {formatTimeValue(todo.start)} – {formatTimeValue(todo.end)}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {todosOpen && (
        <aside className="todo-panel" aria-label="To-do list">
          <header className="todo-panel__header">
            <h3 className="todo-panel__title">To-do</h3>

            <button
              type="button"
              className="todo-panel__close"
              onClick={() => setTodosOpen(false)}
              aria-label="Close to-do list"
            >
              &times;
            </button>
          </header>

          <form className="todo-panel__form" onSubmit={addTodo}>
            <input
              className="todo-panel__input"
              type="text"
              placeholder="Add a task"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="New task"
            />

            <div className="todo-panel__schedule">
              <input
                className="todo-panel__time"
                type="time"
                step="60"
                min={toTimeValue(startMin)}
                max={wraps ? undefined : toTimeValue(endMin)}
                value={draftStart}
                onChange={(event) => setDraftStart(event.target.value)}
                aria-label="Task start time"
              />

              <span className="todo-panel__time-sep">to</span>

              <input
                className="todo-panel__time"
                type="time"
                step="60"
                min={toTimeValue(startMin)}
                max={wraps ? undefined : toTimeValue(endMin)}
                value={draftEnd}
                onChange={(event) => setDraftEnd(event.target.value)}
                aria-label="Task end time"
              />

              <button
                type="submit"
                className="todo-panel__add"
                disabled={!timesValid}
              >
                Add
              </button>
            </div>
          </form>

          <ul className="todo-panel__list">
            {todos.length === 0 && (
              <li className="todo-panel__empty">No tasks yet.</li>
            )}

            {todos.map((todo) => (
              <li
                key={todo.id}
                className={`todo-panel__item${
                  todo.done ? ' todo-panel__item--done' : ''
                }`}
              >
                <button
                  type="button"
                  className="todo-panel__check"
                  onClick={() => toggleTodo(todo.id)}
                  aria-pressed={todo.done}
                  aria-label={`Mark "${todo.text}" ${
                    todo.done ? 'incomplete' : 'complete'
                  }`}
                >
                  {todo.done ? '\u2713' : ''}
                </button>

                <div className="todo-panel__body">
                  <span className="todo-panel__text">{todo.text}</span>
                  <span className="todo-panel__time-badge">
                    {formatTimeValue(todo.start)} – {formatTimeValue(todo.end)}
                  </span>
                </div>

                <button
                  type="button"
                  className="todo-panel__remove"
                  onClick={() => removeTodo(todo.id)}
                  aria-label={`Remove "${todo.text}"`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}

export default HourlyTimeline