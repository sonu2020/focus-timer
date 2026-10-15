import { formatToday } from './time'
import './Header.css'
// import AmbienceMenu from './AmbienceMenu'

function Header({ onStart, todoOpen, todoCount, onToggleTodos }) {
  const { day, monthYear } = formatToday()

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__date">
          <span className="app-header__day">{day}</span>
          <span className="app-header__month">{monthYear}</span>
        </div>

        <div className="app-header__actions">
          <button
            type="button"
            className="app-header__todo"
            onClick={onToggleTodos}
            aria-expanded={todoOpen}
            aria-controls="todo-panel"
          >
            <svg
              className="app-header__todo-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M12 5v14M5 12h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <span>Add task</span>

            {todoCount > 0 && (
              <span className="app-header__todo-count">{todoCount}</span>
            )}
          </button>

          <button type="button" className="app-header__start" onClick={onStart}>
            Update Sprint
          </button>

          {/* <AmbienceMenu /> */}
        </div>
      </div>
    </header>
  )
}

export default Header