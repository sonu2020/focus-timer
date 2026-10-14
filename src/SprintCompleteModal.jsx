import './SprintCompleteModal.css'

function SprintCompleteModal({ open, onDone }) {
  if (!open) return null

  return (
    <div
      className="sprint-complete"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sprint-complete-title"
    >
      <div className="sprint-complete__dialog">
        <span className="sprint-complete__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h2 id="sprint-complete-title" className="sprint-complete__title">
          Sprint complete
        </h2>

        <p className="sprint-complete__text">
          Nicely done. Your focus sprint is finished.
        </p>

        <button
          type="button"
          className="sprint-complete__button"
          onClick={onDone}
          autoFocus
        >
          Done
        </button>
      </div>
    </div>
  )
}

export default SprintCompleteModal
