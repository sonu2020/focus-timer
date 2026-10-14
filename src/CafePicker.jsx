import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { CAFES } from './cafes'
import { playAmbience, subscribeAmbience, getAmbienceId } from './ambience'
import './CafePicker.css'

const STORAGE_KEY = 'focus-timer.cafe'
const DEFAULT_TOTAL = 35 * 60 + 20 // 35:20

function readSavedCafe() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return CAFES.some((item) => item.id === saved) ? saved : CAFES[0].id
  } catch {
    return CAFES[0].id
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// duration can be seconds (number) or "mm:ss" (string) in cafes.js
function toSeconds(duration) {
  if (typeof duration === 'number') return duration
  if (typeof duration === 'string' && duration.includes(':')) {
    const [m, s] = duration.split(':').map(Number)
    return m * 60 + (s || 0)
  }
  return DEFAULT_TOTAL
}

function CafePicker() {
  const [open, setOpen] = useState(false)
  const [cafeId, setCafeId] = useState(readSavedCafe)
  const [elapsed, setElapsed] = useState(0)
  const [pos, setPos] = useState({ left: 16, bottom: 80 })
  const pillRef = useRef(null)
  const playingId = useSyncExternalStore(subscribeAmbience, getAmbienceId)

  const index = Math.max(0, CAFES.findIndex((item) => item.id === cafeId))
  const cafe = CAFES[index]
  const isPlaying = playingId === cafe.id
  const total = toSeconds(cafe.duration)
  const progress = Math.min(100, (elapsed / total) * 100)

  // Keep the card positioned right above the pill
  useLayoutEffect(() => {
    if (!open) return undefined

    function place() {
      const rect = pillRef.current?.getBoundingClientRect()
      if (!rect) return
      setPos({
        left: Math.max(16, rect.left),
        bottom: window.innerHeight - rect.top + 11,
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!isPlaying) return undefined
    const timer = setInterval(() => {
      setElapsed((v) => (v + 1 >= total ? 0 : v + 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [isPlaying, total])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function selectCafe(item) {
    setCafeId(item.id)
    setElapsed(0)
    try {
      localStorage.setItem(STORAGE_KEY, item.id)
    } catch {
      // storage unavailable
    }
    playAmbience(item.id, { file: item.file, fallback: item.sound })
  }

  function togglePlay() {
    playAmbience(isPlaying ? 'off' : cafe.id, {
      file: cafe.file,
      fallback: cafe.sound,
    })
  }

  function step(direction) {
    selectCafe(CAFES[(index + direction + CAFES.length) % CAFES.length])
  }

  const layer = (
    <div className="cafe-player-layer">
      <div
        className="cafe-player__backdrop"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        className="cafe-player__card"
        role="dialog"
        aria-label="Cafe sounds"
        style={{ left: pos.left, bottom: pos.bottom }}
      >
        <button
          type="button"
          className="cafe-player__close"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 5l14 14M19 5L5 19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="cafe-player__bar">
          <div className="cafe-player__bar-fill" style={{ width: `${progress}%` }} />
          <div className="cafe-player__bar-dot" style={{ left: `${progress}%` }} />
        </div>

        <div className="cafe-player__times">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(total)}</span>
        </div>

        <div className="cafe-player__divider" />

        <div className="cafe-player__controls">
          <button
            type="button"
            className="cafe-player__skip"
            onClick={() => step(-1)}
            aria-label="Previous"
          >
            <svg viewBox="0 0 50 26" aria-hidden="true">
              <path
                d="M23 3v20L3 13zM47 3v20L27 13z"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="cafe-player__toggle"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {isPlaying ? (
                <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" />
              ) : (
                <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
              )}
            </svg>
          </button>

          <button
            type="button"
            className="cafe-player__skip"
            onClick={() => step(1)}
            aria-label="Next"
          >
            <svg viewBox="0 0 50 26" aria-hidden="true">
              <path
                d="M3 3v20l20-10zM27 3v20l20-10z"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <ul className="cafe-player__list">
          {CAFES.map((item) => {
            const itemPlaying = playingId === item.id
            return (
              <li key={item.id} className="cafe-player__row">
                <button
                  type="button"
                  className="cafe-player__item"
                  onClick={() => selectCafe(item)}
                >
                  <span className="cafe-player__item-name">{item.name}</span>
                  {itemPlaying ? (
                    <svg
                      className="cafe-player__wave"
                      viewBox="0 0 24 24"
                      aria-label="Playing"
                    >
                      <path
                        d="M3 10v4M7.5 6v12M12 3v18M16.5 7v10M21 10v4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <span className="cafe-player__item-time">
                      {formatTime(toSeconds(item.duration))}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="cafe-player__more"
                  aria-label={`More options for ${item.name}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="4" r="2.2" fill="currentColor" />
                    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
                    <circle cx="12" cy="20" r="2.2" fill="currentColor" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )

  return (
    <div className="cafe-player">
      {open && createPortal(layer, document.body)}

      <button
        ref={pillRef}
        type="button"
        className="cafe-player__pill"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="cafe-player__pill-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {isPlaying ? (
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
            ) : (
              <path d="M8 5v14l11-7z" fill="currentColor" />
            )}
          </svg>
        </span>
        <span className="cafe-player__pill-text">{cafe.name}</span>
        <svg className="cafe-player__pill-caret" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 8h14l-7 9z" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}

export default CafePicker