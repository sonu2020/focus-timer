import { useCallback, useEffect, useRef, useState } from 'react'
import { readStored, writeStored } from './storage'

// Where this visitor's team identity is saved in their browser
const IDENTITY_STORAGE_KEY = 'focus-timer.identity'

// Cached room state per team, so a refresh restores the shared tasks/settings
// even before (or without) the socket reconnecting.
function teamCacheKey(teamId) {
  return `focus-timer.team.${teamId}`
}

function readTeamCache(teamId) {
  if (!teamId) return null

  const cached = readStored(teamCacheKey(teamId))

  return cached && typeof cached === 'object' ? cached : null
}

// Also exported so a visitor can seed a room before the socket connects
export function writeTeamCache(teamId, patch) {
  if (!teamId) return

  const current = readTeamCache(teamId) ?? {}
  writeStored(teamCacheKey(teamId), { ...current, ...patch })
}

// A new, unique team id for each sprint
export function generateTeamId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `team-${crypto.randomUUID()}`
  }

  return `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Returns the saved identity, or null for a solo visitor
export function readIdentity() {
  const saved = readStored(IDENTITY_STORAGE_KEY)

  if (!saved || typeof saved.teamId !== 'string' || !saved.teamId.trim()) {
    return null
  }

  return {
    teamId: saved.teamId.trim(),
  }
}

export function saveIdentity(identity) {
  writeStored(IDENTITY_STORAGE_KEY, identity)
}

// Tracks which team room this browsing session is actively using. The team id
// itself is remembered in localStorage, but a room only counts as "live" for
// the session that joined or created it, so a team left behind by an earlier
// visit never lights up the Live indicator on its own.
const ACTIVE_TEAM_SESSION_KEY = 'focus-timer.active-team'

export function readActiveTeam() {
  try {
    const teamId = sessionStorage.getItem(ACTIVE_TEAM_SESSION_KEY)

    return typeof teamId === 'string' ? teamId.trim() : ''
  } catch {
    return ''
  }
}

export function markTeamActive(teamId) {
  try {
    if (teamId) {
      sessionStorage.setItem(ACTIVE_TEAM_SESSION_KEY, teamId)
    } else {
      sessionStorage.removeItem(ACTIVE_TEAM_SESSION_KEY)
    }
  } catch {
    // storage unavailable; the room just won't stay live across a refresh
  }
}

// Reads the team id out of a "?team=..." invite link, or an empty string
export function readInviteTeam() {
  try {
    return new URLSearchParams(window.location.search).get('team')?.trim() ?? ''
  } catch {
    return ''
  }
}

// ws:// (or wss:// over https) endpoint for a team's live room
function teamSocketUrl(teamId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${window.location.host}/api/teams/${encodeURIComponent(
    teamId,
  )}/ws`
}

// Keeps a live connection to a team's room and mirrors the shared tasks and
// sprint settings. In solo mode (no teamId) it stays idle.
export function useTeamRoom({ teamId, enabled }) {
  const [todos, setTodosState] = useState(() => {
    const cached = readTeamCache(teamId)
    return Array.isArray(cached?.todos) ? cached.todos : []
  })
  const [config, setConfigState] = useState(
    () => readTeamCache(teamId)?.config ?? null,
  )
  const [status, setStatus] = useState('idle')
  // True once the room's state has arrived, so callers can tell "empty" apart
  // from "not loaded yet"
  const [hasState, setHasState] = useState(false)

  const socketRef = useRef(null)
  const todosRef = useRef(todos)
  const [prevTeamId, setPrevTeamId] = useState(teamId)

  // Keep the ref in step with state so handlers never read a stale list
  useEffect(() => {
    todosRef.current = todos
  }, [todos])

  // When the room changes, restore that room's cached state before the socket
  // connects. Adjusting state during render is React's recommended way to reset
  // state when an input changes.
  if (prevTeamId !== teamId) {
    setPrevTeamId(teamId)

    const cached = readTeamCache(teamId)
    const cachedTodos = Array.isArray(cached?.todos) ? cached.todos : []

    setTodosState(cachedTodos)
    setConfigState(cached?.config ?? null)
    setHasState(false)
  }

  useEffect(() => {
    if (!enabled || !teamId) return

    let closed = false
    let socket = null
    let reconnectTimer = null
    let attempts = 0

    function connect() {
      if (closed) return

      setStatus('connecting')
      socket = new WebSocket(teamSocketUrl(teamId))
      socketRef.current = socket

      socket.onopen = () => {
        attempts = 0
        setStatus('online')
      }

      socket.onmessage = (event) => {
        let message

        try {
          message = JSON.parse(event.data)
        } catch {
          return
        }

        if (!message.state) return

        const nextTodos = Array.isArray(message.state.todos)
          ? message.state.todos
          : []
        const nextConfig = message.state.config ?? null

        todosRef.current = nextTodos
        setTodosState(nextTodos)
        setConfigState(nextConfig)
        setHasState(true)

        writeTeamCache(teamId, { todos: nextTodos, config: nextConfig })
      }

      socket.onclose = () => {
        if (closed) return

        setStatus('offline')
        attempts += 1
        const delay = Math.min(1000 * 2 ** (attempts - 1), 10000)
        reconnectTimer = setTimeout(connect, delay)
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      closed = true
      clearTimeout(reconnectTimer)
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close()
      socketRef.current = null
    }
  }, [enabled, teamId])

  const send = useCallback((message) => {
    const socket = socketRef.current

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }, [])

  const setTodos = useCallback(
    (updater) => {
      const next =
        typeof updater === 'function' ? updater(todosRef.current) : updater

      todosRef.current = next
      setTodosState(next)
      writeTeamCache(teamId, { todos: next })
      send({ type: 'setTodos', todos: next })
    },
    [send, teamId],
  )

  const setConfig = useCallback(
    (nextConfig) => {
      setConfigState(nextConfig)
      writeTeamCache(teamId, { config: nextConfig })
      send({ type: 'setConfig', config: nextConfig })
    },
    [send, teamId],
  )

  return {
    status: enabled && teamId ? status : 'idle',
    hasState,
    todos,
    config,
    setTodos,
    setConfig,
  }
}
