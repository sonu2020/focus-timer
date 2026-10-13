import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CAFES } from './cafes'
import { playAmbience, subscribeAmbience, getAmbienceId } from './ambience'

const STORAGE_KEY = 'focus-timer.cafe'

function readSavedCafe() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return CAFES.some((item) => item.id === saved) ? saved : CAFES[0].id
  } catch {
    return CAFES[0].id
  }
}

function CafePicker() {
  const [open, setOpen] = useState(false)
  const [cafeId, setCafeId] = useState(readSavedCafe)
  const rootRef = useRef(null)
  const playingId = useSyncExternalStore(subscribeAmbience, getAmbienceId)

  const cafe = CAFES.find((item) => item.id === cafeId) ?? CAFES[0]
  const isPlaying = playingId === cafe.id

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function chooseCafe(item) {
    setCafeId(item.id)

    try {
      localStorage.setItem(STORAGE_KEY, item.id)
    } catch {
      // storage unavailable
    }

    setOpen(false)
    playAmbience(item.id, { file: item.file, fallback: item.sound })
  }

  function togglePlay() {
    playAmbience(isPlaying ? 'off' : cafe.id, {
      file: cafe.file,
      fallback: cafe.sound,
    })
  }

  return (
    <div className="cafe-picker" ref={rootRef}>
      <div className="hourly-timeline__pill cafe-picker__pill">
        <button
          type="button"
          className="cafe-picker__play"
          onClick={togglePlay}
          aria-pressed={isPlaying}
          aria-label={
            isPlaying
              ? `Pause ${cafe.name} sound`
              : `Play ${cafe.name} sound`
          }
        >
          <svg
            className="hourly-timeline__pill-play"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {isPlaying ? (
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
            ) : (
              <path d="M8 5v14l11-7z" fill="currentColor" />
            )}
          </svg>
        </button>

        <button
          type="button"
          className="cafe-picker__main"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="hourly-timeline__pill-text">{cafe.name}</span>

          <svg
            className="hourly-timeline__pill-caret"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <ul className="cafe-picker__list" role="listbox" aria-label="Choose a cafe">
          {CAFES.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={item.id === cafeId}
                className={`cafe-picker__option${item.id === cafeId ? ' active' : ''}`}
                onClick={() => chooseCafe(item)}
              >
                <span>{item.name}</span>
                <small>{item.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CafePicker