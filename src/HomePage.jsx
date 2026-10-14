import './HomePage.css'

function HomePage({ onStart }) {
  const today = new Date()
  const day = today.toLocaleDateString('en-US', { weekday: 'long' })
  const monthYear = today.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className="home">
      <header className="home__header">
        <div className="home__header-inner">
          <div className="home__date">
            <span className="home__day">{day}</span>
            <span className="home__month">{monthYear}</span>
          </div>
        </div>
      </header>

      <div className="home__body">
        <div className="home__card">
          <svg
            className="home__illustration"
            viewBox="0 0 260 180"
            fill="none"
            aria-hidden="true"
          >
            <path
              className="home__trail"
              d="M18 152 C 58 146, 68 108, 102 92 C 134 77, 152 60, 176 46"
            />

            <g className="home__butterfly" transform="translate(178, 42)">
              <path d="M0 4 C -5 -6, -22 -12, -27 -2 C -31 7, -16 15, 0 9" />
              <path d="M0 4 C 5 -6, 22 -12, 27 -2 C 31 7, 16 15, 0 9" />
              <path d="M0 9 C -4 13, -12 22, -5 26 C -1 28, 2 18, 0 9" />
              <path d="M0 9 C 4 13, 12 22, 5 26 C 1 28, -2 18, 0 9" />
              <path d="M0 2 L0 22" />
              <path d="M0 2 C -3 -3, -6 -6, -10 -8" />
              <path d="M0 2 C 3 -3, 6 -6, 10 -8" />
            </g>
          </svg>

          <h1 className="home__title">
            Ready to accelerate your productivity?
          </h1>

          <p className="home__subtitle">
            Configure your settings and launch your focus sprint here.
          </p>

          <button type="button" className="home__cta" onClick={onStart}>
            Start a sprint
          </button>
        </div>
      </div>
    </section>
  )
}

export default HomePage
