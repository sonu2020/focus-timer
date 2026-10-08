import { useEffect, useRef, useState } from 'react'
import { AMBIENCE_TRACKS, playAmbience, setAmbienceVolume } from './ambience'

function AmbienceMenu() {
  const [open, setOpen] = useState(false)
  const [track, setTrack] = useState('off')
  const [volume, setVolume] = useState(60)
  const rootRef = useRef(null)

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

  function chooseTrack(id) {
    if (id === track && track !== 'off') {
      setTrack('off')
      playAmbience('off')
      return
    }

    setTrack(id)
    playAmbience(id)
  }

  function changeVolume(event) {
    const next = Number(event.target.value)
    setVolume(next)
    setAmbienceVolume(next / 100)
  }

  return (
    <div className="music-menu" ref={rootRef}>
      <button
        className={`settings-button music-button${track !== 'off' ? ' is-active' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Ambience and focus music"
        title="Ambience and focus music"
      >
        ♫
      </button>

      {open && (
        <div className="music-panel" role="menu">
          <p className="music-panel-title">Ambience &amp; focus</p>

          <ul className="music-options">
            {AMBIENCE_TRACKS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={track === item.id}
                  className={`music-option${track === item.id ? ' active' : ''}`}
                  onClick={() => chooseTrack(item.id)}
                >
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              </li>
            ))}
          </ul>

          <div className="music-volume">
            <label htmlFor="ambience-volume">Volume</label>
            <input
              id="ambience-volume"
              type="range"
              min="0"
              max="100"
              step="1"
              value={volume}
              onChange={changeVolume}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default AmbienceMenu
