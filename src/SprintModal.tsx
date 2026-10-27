import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, MouseEvent } from "react";
import {
  hasSprintStarted,
  minutesOfDay,
  parseTime,
  toTimeValue,
} from "./time";
import ThemeToggle from "./ThemeToggle";
import "./SprintModal.css";

const BLOCK_PRESETS = [3, 5, 10];

const CUSTOM_BLOCK_OPTIONS = Array.from(
  { length: 12 },
  (_, index) => index + 1,
);

const THEMES = [
  { name: "Green", value: "#52d696", border: "#2E7D56" },
  { name: "Orange", value: "#f59e0b", border: "#C76A13" },
  { name: "Red", value: "#ef4444", border: "#C0392B" },
  { name: "Purple", value: "#8b5cf6", border: "#6C5CE7" },
  { name: "Dark Gray", value: "#374151", border: "#2C3A47" },
  { name: "Blue", value: "#3b82f6", border: "#1d4ed8" },
  { name: "Yellow", value: "#facc15", border: "#b45309" },
  { name: "Pink", value: "#ec4899", border: "#be185d" },
];

export interface SprintConfig {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  length: string;
  blockCount: number;
  themeName: string;
  theme: string;
}

interface SprintModalProps {
  open: boolean;
  mode?: "create" | "update";
  initial?: Partial<SprintConfig>;
  onClose: () => void;
  onStart: (config: SprintConfig) => void;
  onGetInviteLink?: (config: SprintConfig, teamId?: string) => string;
  onEnableInvite?: () => string | undefined;
}

function Caret() {
  return (
    <svg className="sprint-modal__caret" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Open the browser's time picker when the field is clicked
function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {
    // showPicker is not supported or not allowed here; typing still works
  }
}

function SprintModal({
  open,
  mode = "create",
  initial,
  onClose,
  onStart,
  onGetInviteLink,
  onEnableInvite,
}: SprintModalProps) {
  const isUpdate = mode === "update";

  const [startTime, setStartTime] = useState<string>(
    initial?.startTime ??
      toTimeValue(
        minutesOfDay(initial?.startHour ?? 9, initial?.startMinute ?? 0),
      ),
  );
  const [endTime, setEndTime] = useState<string>(
    initial?.endTime ??
      toTimeValue(
        minutesOfDay(initial?.endHour ?? 19, initial?.endMinute ?? 0),
      ),
  );
  const [error, setError] = useState("");
  const [length, setLength] = useState<string>(initial?.length ?? "10");
  const [customBlocks, setCustomBlocks] = useState<number>(
    initial?.length === "Customize" ? (initial.blockCount ?? 6) : 6,
  );
  const [theme, setTheme] = useState<string>(initial?.themeName ?? "Green");

  // A shareable link that recreates this sprint and opens its room
  const [copied, setCopied] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const blockCount = length === "Customize" ? customBlocks : Number(length);

  // Reads the settings as they currently stand in the modal
  function currentConfig(): SprintConfig {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const selected = THEMES.find((item) => item.name === theme);

    return {
      startHour: start?.hour ?? 9,
      startMinute: start?.minute ?? 0,
      endHour: end?.hour ?? 19,
      endMinute: end?.minute ?? 0,
      startTime,
      endTime,
      length,
      blockCount,
      themeName: theme,
      theme: selected ? selected.value : "#52d696",
    };
  }

  // Regenerated on every change so the link always matches the current setup
  const shareLink =
    typeof onGetInviteLink === "function"
      ? onGetInviteLink(currentConfig())
      : "";

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Drop the "Copied!" confirmation after a moment
  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  function changeStart(event: ChangeEvent<HTMLInputElement>) {
    setStartTime(event.target.value);
    setError("");
  }

  function changeEnd(event: ChangeEvent<HTMLInputElement>) {
    setEndTime(event.target.value);
    setError("");
  }

  // Creates or reuses the shared room as soon as the visitor shows intent to
  // share, so both the visible link and the copied link include the room id.
  function prepareShareLink() {
    const teamId = onEnableInvite?.();
    const config = currentConfig();

    return onGetInviteLink?.(config, teamId) ?? shareLink;
  }

  // Copies the shareable link, with a fallback for browsers that block
  // the async clipboard API
  async function copyShareLink() {
    const link = prepareShareLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError("");
      return;
    } catch {
      // Fall through to the manual selection fallback below
    }

    const input = linkInputRef.current;

    if (input) {
      input.value = link;
      input.focus();
      input.select();
    }

    let copiedBySelection = false;

    try {
      copiedBySelection = document.execCommand("copy");
    } catch {
      copiedBySelection = false;
    }

    if (copiedBySelection) {
      setCopied(true);
      setError("");
    } else {
      setError("Copying was blocked. Select the link and copy it manually.");
    }
  }

  function handleStart() {
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (!start || !end) {
      setError("Please enter both a start and an end time.");
      return;
    }

    if (end.hour * 60 + end.minute <= start.hour * 60 + start.minute) {
      setError("The end time must be after the start time.");
      return;
    }

    if (
      !hasSprintStarted({ startHour: start.hour, startMinute: start.minute })
    ) {
      setError(
        `This sprint starts at ${toTimeValue(
          minutesOfDay(start.hour, start.minute),
        )}. You can open it once that time arrives.`,
      );
      return;
    }

    onStart(currentConfig());
  }

  if (!open) return null;

  return (
    <div className="sprint-modal" role="presentation" onClick={onClose}>
      <div
        className="sprint-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sprint-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="sprint-modal__close"
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="sprint-modal__theme">
          <ThemeToggle />
        </div>

        <h2 id="sprint-modal-title" className="sprint-modal__title">
          {isUpdate ? "Update your sprint" : "Create a Sprint"}
        </h2>
        <div className="sprint-modal__field">
          <label className="sprint-modal__label" htmlFor="sprint-start">
            When does your day start?
          </label>
          <input
            id="sprint-start"
            className="sprint-modal__time"
            type="time"
            value={startTime}
            onChange={changeStart}
            onClick={openPicker}
            required
          />
        </div>

        <div className="sprint-modal__field">
          <label className="sprint-modal__label" htmlFor="sprint-end">
            When does your day end?
          </label>
          <input
            id="sprint-end"
            className="sprint-modal__time"
            type="time"
            value={endTime}
            onChange={changeEnd}
            onClick={openPicker}
            required
          />
        </div>

        <p className="sprint-modal__hint">
          Click the field or type a time, like 10:14.
        </p>

        {error && (
          <p className="sprint-modal__error" role="alert">
            {error}
          </p>
        )}

        <div className="sprint-modal__field">
          <span className="sprint-modal__label">How long is the sprint?</span>
          <div className="sprint-modal__segments" role="group">
            {BLOCK_PRESETS.map((option) => (
              <button
                key={option}
                type="button"
                className={`sprint-modal__segment${
                  length === String(option)
                    ? " sprint-modal__segment--active"
                    : ""
                }`}
                onClick={() => setLength(String(option))}
              >
                {option}
              </button>
            ))}

            <select
              className={`sprint-modal__segment sprint-modal__segment--select${
                length === "Customize" ? " sprint-modal__segment--active" : ""
              }`}
              value={length === "Customize" ? String(customBlocks) : ""}
              onChange={(event) => {
                setLength("Customize");
                setCustomBlocks(Number(event.target.value));
              }}
              aria-label="Custom block count"
            >
              <option value="" disabled>
                Customize
              </option>

              {CUSTOM_BLOCK_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sprint-modal__field">
          <span className="sprint-modal__label">Choose your sprint theme</span>
          <div className="sprint-modal__swatches" role="group">
            {THEMES.map((item) => (
              <button
                key={item.name}
                type="button"
                className={`sprint-modal__swatch${
                  theme === item.name ? " sprint-modal__swatch--active" : ""
                }`}
                style={
                  {
                    "--swatch": item.value,
                    "--swatch-border": item.border,
                  } as CSSProperties
                }
                onClick={() => setTheme(item.name)}
                aria-label={item.name}
                aria-pressed={theme === item.name}
                title={item.name}
              />
            ))}
          </div>
        </div>

        <div className="sprint-modal__field">
          <span className="sprint-modal__label">Share this sprint</span>

          <div className="sprint-modal__invite">
            <div className="sprint-modal__invite-row">
              <input
                ref={linkInputRef}
                className="sprint-modal__link"
                type="text"
                value={shareLink}
                readOnly
                aria-label="Shareable sprint link"
                onFocus={(event) => {
                  const link = prepareShareLink();
                  event.currentTarget.value = link;
                  event.currentTarget.select();
                }}
              />

              <button
                type="button"
                className={`sprint-modal__copy${
                  copied ? " sprint-modal__copy--copied" : ""
                }`}
                onClick={copyShareLink}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            <p className="sprint-modal__invite-status" role="status">
              {copied
                ? "Link copied to your clipboard."
                : "Share this link so a teammate can open the same sprint."}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="sprint-modal__submit"
          onClick={handleStart}
        >
          {isUpdate ? "Save Changes" : "Start Now"}
          <Caret />
        </button>
      </div>
    </div>
  );
}

export default SprintModal;
