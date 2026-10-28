import { formatToday } from "./time";
import "./Header.css";

type TeamStatus = "online" | "connecting" | "offline";

const LIVE_LABELS: Record<TeamStatus, string> = {
  online: "Live",
  connecting: "Connecting",
  offline: "Offline",
};

interface HeaderProps {
  onStart: () => void;
  todoOpen: boolean;
  todoCount: number;
  onToggleTodos: () => void;
  collaborating: boolean;
  teamStatus: TeamStatus;
}

function Header({
  onStart,
  todoOpen,
  todoCount,
  onToggleTodos,
  collaborating,
  teamStatus,
}: HeaderProps) {
  const { day, monthYear } = formatToday();

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__date">
          <span className="app-header__day">{day}</span>
          <span className="app-header__month">{monthYear}</span>
        </div>

        {collaborating && (
          <span
            className={`app-header__live app-header__live--${teamStatus}`}
            role="status"
            title={`Sprint sync: ${LIVE_LABELS[teamStatus] ?? "Offline"}`}
          >
            <span className="app-header__live-dot" aria-hidden="true" />
            {LIVE_LABELS[teamStatus] ?? "Offline"}
          </span>
        )}

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
        </div>
      </div>
    </header>
  );
}

export default Header;
