# Focus Timer

Focus Timer is a browser-based productivity app built around clock-anchored focus
sprints. It combines a visual hourly timeline, scheduled tasks, ambient cafe
soundscapes, and optional real-time collaboration for small groups.

There is no account system. A visitor can open the app, choose the start and end
of their working day, pick how many focus blocks to divide it into, and begin
immediately. Collaboration only activates when a user explicitly invites someone
to a shared room.

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Data and storage](#data-and-storage)
- [Accessibility](#accessibility)
- [Current limitations](#current-limitations)
- [Audio assets](#audio-assets)

## Overview

Focus Timer is designed around two ideas:

1. **Focused work should start with minimal friction.** The home screen leads
   directly into sprint setup, and the working view is tied to the real clock
   rather than a separate stopwatch.
2. **Lightweight collaboration should be available when needed.** A solo sprint
   can become a shared room through a link, with tasks and sprint settings
   synchronized live while the app remains fully usable offline.

The application is client-first. Solo state is stored in the browser; the
Cloudflare backend is used only for shared team rooms and for serving the
production build.

## Features

### Sprint planning

- Create or update a sprint from a single dialog.
- Choose a start time, end time, block count, and color theme.
- Block presets of 3, 5, and 10, plus a custom count from 1 to 12.
- Eight theme colors: green, orange, red, purple, dark gray, blue, yellow, and
  pink.
- The sprint is anchored to the selected clock window, not to the moment the
  user clicks Start.
- The timeline calculation supports windows that cross midnight, although the
  sprint dialog currently requires the end time to be after the start time.

### Hourly timeline

- A horizontal timeline spans the selected day and marks every whole hour in the
  window.
- The sprint is divided into focus blocks that drain from the top down as time
  passes.
- A live "now" marker tracks the current time and toggles the task panel.
- A countdown appears during the final five minutes of the active block and turns
  critical in the final two and a half minutes.
- Remaining sprint time is always visible.
- The timeline refreshes with `requestAnimationFrame` and immediately on tab
  visibility changes.
- At the end of the sprint, a completion dialog offers to wrap up or extend the
  sprint by 15 minutes, 30 minutes, one hour, or a custom end time.

### Tasks

- Add tasks with a title and a scheduled start and end time.
- Mark tasks complete, reopen them, or remove them.
- Scheduled tasks appear in a side list with their time ranges.
- A full to-do panel provides the editing controls.
- The header displays the number of outstanding tasks.
- Starting a new sprint clears the task list.

### Team collaboration

- The sprint dialog always offers a share link. Copying or focusing it creates
  a shared room with a generated room ID. Each new sprint gets a fresh room ID;
  updating an existing sprint keeps its room.
- Clients connect over WebSocket to `/api/teams/:teamId/ws`.
- The room shares the task list and sprint configuration.
- Changes are persisted in the Durable Object's storage and broadcast to every
  connected client.
- The client reconnects automatically with exponential backoff, capped at 10
  seconds.
- Room state is cached in the browser so a refresh can restore the shared view
  before the socket reconnects.
- A Live / Connecting / Offline indicator shows synchronization state.
- The backend uses Cloudflare's WebSocket Hibernation API so idle rooms do not
  need to remain continuously active.

### Shareable links

- Sprint settings are packed into a URL-safe Base64 `?sprint=...` parameter, so
  a recipient can recreate the sprint without a backend lookup.
- When a team room is active, the link also includes `?team=...` so the
  recipient joins the shared room.
- Shared links open directly into the timeline view once the sprint's start
  time has arrived. Before then the app stays on the home screen.
- Share parameters are removed from the address bar after they are handled.
- A manual clipboard fallback is provided for browsers that block the async
  Clipboard API.

### Cafe ambience

- A cafe-style sound picker offers five bundled environments:
  - Third Wave, Koramangala — jazzy lo-fi
  - Blue Tokai, Koramangala — ambient pulse
  - Matteo Coffea, Koramangala — gentle bossa nova
  - Hole in the Wall Cafe, Koramangala — sunlit bossa
  - Starbucks, Koramangala — Parisian waltz
- If a track cannot play, the app generates a fallback with the Web Audio API,
  including rain, waves, forest, brown noise, pink noise, a focus pad, and
  layered cafe atmospheres.
- Playback controls include play/pause, previous/next selection, elapsed and
  total time, and a progress bar.
- The selected cafe is remembered locally.

### Notifications and alerts

- A synthesized two-note chime plays when a focus block ends.
- Audio is unlocked on the first user interaction so the chime can play later
  without a gesture.
- Browser notification permission is requested when a sprint is created, and a
  notification is shown when permission has been granted.

### Personalization

- Light and dark themes, initialized from the operating system preference and
  persisted locally.
- The theme toggle is available inside the sprint dialog.
- Sprint settings, tasks, and the active view persist for the browsing session,
  so a reload restores the current work while a fresh visit starts clean.
- Theme, selected cafe, and team identity persist in `localStorage`.

## Tech stack

| Layer | Technology | Role |
| --- | --- | --- |
| UI | React 19 | Component-based interface and state management |
| Language | TypeScript / JSX | Typed application code; `strict` is disabled and JavaScript is allowed |
| Build | Vite 8 with `@vitejs/plugin-react` | Development server, HMR, and production bundling |
| Styling | Custom CSS with design tokens | Component styles, theming, responsive and reduced-motion rules |
| Backend | Cloudflare Workers | Serves API and WebSocket traffic alongside static assets |
| Stateful backend | Cloudflare Durable Objects | One `TeamRoom` per team ID, with SQLite-backed storage |
| Real-time transport | WebSocket via the Workers Hibernation API | Live synchronization of room state |
| Deployment | Wrangler 4 and Cloudflare Workers Assets | Build and deploy pipeline |
| Linting | Oxlint | Fast static analysis |
| Package management | Bun | Dependency installation and script execution |
| Audio | Web Audio API and HTML audio elements | Generated ambience and bundled soundscapes |
| Fonts | Plus Jakarta Sans and Outfit | Typography via Google Fonts |

## Architecture

```text
Browser
├── React SPA (Vite build)
│   ├── Home view
│   ├── Timeline view
│   │   ├── Hourly timeline and tasks
│   │   ├── Cafe sound picker
│   │   └── Sprint completion dialog
│   ├── Sprint dialog and theme toggle
│   └── useTeamRoom ── WebSocket ──┐
│                                  │
├── localStorage                   │
│   ├── theme                      │
│   ├── cafe choice                │
│   ├── team identity              │
│   └── room cache                 │
└── sessionStorage                 │
    ├── sprint configuration       │
    ├── tasks                      │
    ├── view mode                  │
    └── active team                │
                                   │
                     wss://host/api/teams/:id/ws
                                   │
Cloudflare Worker                  │
├── Workers Assets: serves dist/   │
│   with SPA fallback              │
└── /api/teams/:teamId/ws ─────────┘
    └── TEAM_ROOMS namespace
        └── TeamRoom Durable Object
            ├── shared tasks and sprint config
            ├── SQLite-backed storage
            └── WebSocket broadcast
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) for dependency installation and scripts.
- Node.js 20 or newer for the Vite and Wrangler toolchain.
- A Cloudflare account only if you intend to deploy the Worker.

### Install

```bash
bun install
```

The `postinstall` hook runs a production build automatically.

### Run locally

```bash
bun run dev
```

This starts two processes:

- Vite on its default port, usually `http://localhost:5173`.
- Wrangler's local Worker runtime on port `8787`.

Vite proxies `/api` and WebSocket traffic to the local Worker, so collaboration
works in development.

You can also run the processes separately:

```bash
bun run dev:client
bun run dev:api
```

### Build

```bash
bun run build
```

The static bundle is written to `dist/`.

### Deploy

Authenticate Wrangler first if you have not already:

```bash
bunx wrangler login
```

Then deploy:

```bash
bun run deploy
```

The deploy script builds the frontend and publishes the Worker, assets, and
Durable Object migration defined in `wrangler.jsonc`.

### Lint

```bash
bun run lint
```

## Available scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Runs the Vite client and the local Wrangler Worker together |
| `bun run dev:client` | Runs only Vite |
| `bun run dev:api` | Runs only Wrangler on port 8787 |
| `bun run build` | Builds the production bundle into `dist/` |
| `bun run deploy` | Builds and deploys with Wrangler |
| `bun run lint` | Runs Oxlint |
| `bun run preview` | Serves the production build locally |
| `bun run postinstall` | Builds automatically after dependency installation |

## Project structure

```text
focus-timer/
├── src/
│   ├── App.tsx                  Composition root and sprint orchestration
│   ├── main.tsx                 React entry point
│   ├── HomePage.tsx             Landing view
│   ├── Header.tsx               Date, sync status, task count, sprint action
│   ├── HourlyTimeline.tsx       Timeline, countdown, tasks, block alerts
│   ├── SprintModal.tsx          Sprint setup and invite link UI
│   ├── SprintCompleteModal.tsx  Wrap-up and extension flow
│   ├── CafePicker.tsx           Cafe soundscape player
│   ├── ThemeToggle.tsx          Light/dark mode button
│   ├── useTeamRoom.ts           Team WebSocket state, identity, and cache
│   ├── useTheme.ts              Theme initialization and persistence
│   ├── sprintShare.ts           URL-safe sprint sharing
│   ├── storage.ts               Safe localStorage and sessionStorage wrappers
│   ├── time.ts                  Clock math and formatting helpers
│   ├── ambience.ts              Web Audio generation and file playback
│   ├── cafes.ts                 Cafe track catalog
│   ├── blockAlerts.ts           Chime and notification helpers
│   └── *.css                    Global, component, and theme styles
├── worker/
│   └── index.js                 Worker entry point and TeamRoom Durable Object
├── scripts/
│   └── dev.mjs                  Concurrent Vite and Wrangler dev runner
├── public/
│   ├── audio/                   Bundled soundscape tracks
│   └── favicon.svg
├── index.html                   SPA host document
├── vite.config.js               Vite configuration and API proxy
├── wrangler.jsonc               Worker, assets, and Durable Object bindings
├── tsconfig.json                TypeScript configuration
├── .oxlintrc.json               Oxlint configuration
├── package.json                 Scripts and dependencies
└── bun.lock                     Bun lockfile
```

## How it works

### Views

The app has two active views:

- **Home** — the landing screen with the sprint call to action.
- **Timeline** — the working view with the clock-driven timeline, tasks, cafe
  picker, and sprint completion flow.

`App.tsx` owns the application state, including sprint configuration, tasks,
identity, team mode, view mode, and the Pomodoro timer logic. The view is
restored from `sessionStorage` on reload and is set to `timeline` when a shared
sprint link is opened.

The Pomodoro timer interface and cadence are implemented in `App.tsx`, but the
current view flow never selects the timer view.

### Timeline behavior

The timeline derives everything from the current clock time and the selected
sprint window:

- Elapsed time is measured from the chosen start time.
- The sprint span is divided evenly into the selected number of blocks.
- Each block's fill is clipped from the top according to how much of that block
  has elapsed.
- Hour ticks are generated for every whole hour inside the window.
- The countdown and block-end notification are driven by the active block.

### Collaboration flow

1. The user creates or updates a sprint in the sprint dialog.
2. When the user copies or focuses the share link, the app uses the sprint's own
   team ID (fresh for a new sprint, reused when updating), stores the identity,
   caches the current tasks and configuration, and builds a link containing both
   `sprint` and `team` parameters.
3. The recipient opens the link. The app decodes the sprint, activates the team,
   and connects to the room.
4. The Durable Object sends the authoritative room state.
5. Task and sprint changes are applied optimistically on the client and sent to
   the room.
6. The room persists the change and broadcasts the new snapshot to all connected
   clients.
7. If the socket drops, the client shows the offline state and retries with
   exponential backoff while cached state keeps the interface usable.

### Backend

The Worker entry point routes WebSocket upgrade requests at
`/api/teams/:teamId/ws` to the Durable Object named by that team ID. Static
assets are served by Cloudflare Workers Assets with single-page-application
fallback, and `/api/*` requests are routed to the Worker first.

Each `TeamRoom` Durable Object:

- loads persisted state during construction with `blockConcurrencyWhile`,
- accepts WebSocket connections using `ctx.acceptWebSocket`,
- sends the current snapshot when a client connects,
- handles `setTodos` and `setConfig` messages,
- persists changes under the `room` storage key,
- broadcasts the public state to every connected socket.

The shared snapshot contains tasks and sprint configuration.

## Data and storage

| Data | Storage | Lifetime |
| --- | --- | --- |
| Sprint configuration (solo) | `sessionStorage` (`focus-timer.sprint-config`) | Current tab session |
| Tasks (solo) | `sessionStorage` (`focus-timer.todos`) | Current tab session |
| Active view | `sessionStorage` (`focus-timer.view-mode`) | Current tab session |
| Active team | `sessionStorage` (`focus-timer.active-team`) | Current tab session |
| Theme | `localStorage` (`theme`) | Persistent |
| Selected cafe | `localStorage` (`focus-timer.cafe`) | Persistent |
| Team identity | `localStorage` (`focus-timer.identity`) | Persistent |
| Room cache | `localStorage` (`focus-timer.team.<teamId>`) | Persistent until cleared |
| Shared sprint | URL `?sprint=` parameter | Per link |
| Team tasks and configuration | Durable Object storage (`room`) | Shared room lifetime |

All browser storage access is wrapped in fail-safe helpers, so disabled or full
storage does not crash the app.

## Accessibility

- Semantic landmarks and ARIA roles are used throughout the interface.
- The sprint dialog and cafe menu can be closed with `Escape`.
- Buttons have descriptive labels, and interactive controls expose expanded and
  pressed states where appropriate.
- Status messages use live regions, and timers expose `role="timer"`.
- Reduced-motion media queries are included in the stylesheet.
- Layouts adapt to tablet and mobile widths.
- Empty or inverted time ranges produce explicit validation messages.

## Current limitations

- **The classic timer view is not reachable.** The Pomodoro timer logic and
  circular timer interface exist in `App.tsx`, but the current view flow only
  selects Home or Timeline.
- **Timer state is local.** Team rooms synchronize tasks and sprint
  configuration only; timer mode, timer progress, and audio playback stay in
  each browser.
- **No accounts or authentication.** Anyone with a room ID can join, so the
  collaboration model is intended for trusted small groups.
- **Connection status only.** The backend does not track member identities; the
  UI shows only whether the room connection is live.
- **Solo state is session-scoped.** Clearing site data removes local identity,
  cached rooms, and preferences. Solo sprint data is intentionally limited to
  the tab session.
- **No automated tests.** Oxlint is the only static check configured.
- **Project metadata is stale.** `index.html` still uses the title
  `my-first-react-app`, and `package.json` is still version `0.0.0`.

## Audio assets

The bundled cafe tracks in `public/audio/` should have their usage rights
confirmed before public distribution. The app can generate fallback ambience
with the Web Audio API if a file is unavailable or cannot be played.
