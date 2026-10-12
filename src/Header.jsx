import './Header.css'
import AmbienceMenu from './AmbienceMenu'

function Header({ onStart }) {
  const today = new Date()
  const day = today.toLocaleDateString('en-US', { weekday: 'long' })
  const monthYear = today.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__date">
          <span className="app-header__day">{day}</span>
          <span className="app-header__month">{monthYear}</span>
        </div>

        <div className="app-header__actions">
          <button type="button" className="app-header__start" onClick={onStart}>
            Start a Sprint
          </button>

          <AmbienceMenu />
        </div>
      </div>
    </header>
  )
}

export default Header