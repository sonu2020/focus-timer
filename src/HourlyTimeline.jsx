import { useEffect, useRef, useState } from 'react'
import './HourlyTimeline.css'
import { notifyBlockEnd } from './blockAlerts'
import CafePicker from './CafePicker'

const DAY_MINUTES = 1440

const COUNTDOWN_MINUTES = 5
const COUNTDOWN_CRITICAL_MINUTES = 2.5

function getMinutesNow() {
  const now = new Date()

  return (
    now.getHours() * 60 +
    now.getMinutes() +
    now.getSeconds() / 60 +
    now.getMilliseconds() / 60000
  )
}

function formatCountdown(minutesLeft) {
  const totalSeconds = Math.max(0, Math.ceil(minutesLeft * 60))
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const secs = String(totalSeconds % 60).padStart(2, '0')

  return `${mins}:${secs}`
}

function formatHour(hour24) {
  const suffix = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return {
    time: `${String(hour12).padStart(2, '0')}:00`,
    suffix,
  }
}

function formatLabel(hour24) {
  const { time, suffix } = formatHour(hour24)

  return `${time} ${suffix}`
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

function toTimeValue(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function defaultEndHour(startHour, endHour) {
  if (endHour <= startHour) return (startHour + 1) % 24

  return Math.min(startHour + 1, endHour)
}

function HourlyTimeline({
  config,
  todos,
  setTodos,
  todosOpen,
  setTodosOpen,
  onSprintEnd,
}) {
  const startHour = config?.startHour ?? 9
  const endHour = config?.endHour ?? 19
  const blockCount = Math.max(1, config?.blockCount ?? 10)
  const theme = config?.theme ?? '#52d696'

  const onSprintEndRef = useRef(onSprintEnd)
  const previousBlockRef = useRef(null)

  const [minutes, setMinutes] = useState(getMinutesNow)
  const [draft, setDraft] = useState('')
  const [draftStart, setDraftStart] = useState(toTimeValue(startHour))
  const [draftEnd, setDraftEnd] = useState(() =>
    toTimeValue(defaultEndHour(startHour, endHour)),
  )
  const [window, setWindow] = useState({ startHour, endHour })

  if (window.startHour !== startHour || window.endHour !== endHour) {
    setWindow({ startHour, endHour })
    setDraftStart(toTimeValue(startHour))
    setDraftEnd(toTimeValue(defaultEndHour(startHour, endHour)))
  }

  const timesValid =
    draftStart && draftEnd && (endHour <= startHour || draftStart < draftEnd)

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
        setMinutes(getMinutesNow())
        lastPaint = time
      }

      frameId = requestAnimationFrame(tick)
    }

    function refresh() {
      setMinutes(getMinutesNow())
    }

    frameId = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  let totalHours = ((endHour - startHour) + 24) % 24

  if (totalHours === 0) totalHours = 24

  const startMinutes = startHour * 60
  const span = totalHours * 60
  const wraps = endHour <= startHour

  const elapsed = wraps
    ? ((minutes - startMinutes) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES
    : minutes - startMinutes

  const inRange = elapsed >= 0 && elapsed < span
  const nowPercent = inRange ? (elapsed / span) * 100 : 0

  const endHourMinutes = endHour * 60
  const sprintEnded = wraps
    ? minutes >= endHourMinutes && minutes < startMinutes
    : minutes >= endHourMinutes
  const current = formatHour(Math.floor(minutes / 60) % 24)

  const blockSpan = span / blockCount

  const blocks = Array.from({ length: blockCount }, (_, index) => {
    const progress = Math.min(
      1,
      Math.max(0, (elapsed - index * blockSpan) / blockSpan),
    )

    return { index, progress }
  })

  const activeIndex = inRange
    ? Math.min(blockCount - 1, Math.floor(elapsed / blockSpan))
    : null

  let countdown = null

  if (activeIndex !== null) {
    const blockEnd = (activeIndex + 1) * blockSpan
    const remaining = blockEnd - elapsed

    if (remaining <= COUNTDOWN_MINUTES) {
      countdown = {
        text: formatCountdown(remaining),
        critical: remaining <= COUNTDOWN_CRITICAL_MINUTES,
      }
    }
  }

  const ticks = Array.from({ length: totalHours - 1 }, (_, index) => {
    const hour = (startHour + index + 1) % 24

    return { hour, left: ((index + 1) / totalHours) * 100 }
  })

  useEffect(() => {
    onSprintEndRef.current = onSprintEnd
  }, [onSprintEnd])

  useEffect(() => {
    if (activeIndex === null) {
      previousBlockRef.current = null
      return
    }

    const previous = previousBlockRef.current
    previousBlockRef.current = activeIndex

    if (previous !== null && activeIndex > previous) {
      notifyBlockEnd()
    }
  }, [activeIndex])

  useEffect(() => {
    if (sprintEnded) onSprintEndRef.current?.()
  }, [sprintEnded])

  return (
    <div className={`timeline-shell${todosOpen ? ' timeline-shell--open' : ''}`}>
      <section className="hourly-timeline" aria-label="Hourly timeline">
      <span className="hourly-timeline__edge hourly-timeline__edge--start">
        {formatLabel(startHour)}
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
          />
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

        {formatLabel(endHour)}
      </span>

      <div className="hourly-timeline__grid">
        {blocks.map(({ index, progress }) => (
          <div
            key={index}
            className="hourly-timeline__block"
            style={{
              '--block-color': theme,
              '--block-progress': progress,
            }}
          />
        ))}
      </div>

      <div className="hourly-timeline__status">
        <CafePicker />
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
        <aside id="todo-panel" className="todo-panel" aria-label="To-do list">
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
                min={toTimeValue(startHour)}
                max={endHour <= startHour ? undefined : toTimeValue(endHour)}
                value={draftStart}
                onChange={(event) => setDraftStart(event.target.value)}
                aria-label="Task start time"
              />

              <span className="todo-panel__time-sep">to</span>

              <input
                className="todo-panel__time"
                type="time"
                step="60"
                min={toTimeValue(startHour)}
                max={endHour <= startHour ? undefined : toTimeValue(endHour)}
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