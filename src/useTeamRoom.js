import { useCallback, useEffect, useRef, useState } from 'react'
import { readStored, removeStored, writeStored } from './storage'

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

function writeTeamCache(teamId, patch) {
  if (!teamId) return

  const current = readTeamCache(teamId) ?? {}
  writeStored(teamCacheKey(teamId), { ...current, ...patch })
}

// A short, random team id used when someone taps "New"
export function generateTeamId() {
  return `team-${Math.random().toString(36).slice(2, 8)}`
}

// Returns the saved identity, or null for a solo visitor
export function readIdentity() {
  const saved = readStored(IDENTITY_STORAGE_KEY)

  if (!saved || typeof saved.teamId !== 'string' || !saved.teamId.trim()) {
    return null
  }

  return {
    email: typeof saved.email === 'string' ? saved.email.trim() : '',
    teamId: saved.teamId.trim(),
  }
}

export function saveIdentity(identity) {
  writeStored(IDENTITY_STORAGE_KEY, identity)
}

export function clearIdentity() {
  removeStored(IDENTITY_STORAGE_KEY)
}

// The shareable link that drops a teammate straight into this team
export function getInviteLink(teamId) {
  return `${window.location.origin}/?team=${encodeURIComponent(teamId)}`
}

// Reads the team id out of a "?team=..." invite link, or an empty string
export function readInviteTeam() {
  try {
    return new URLSearchParams(window.location.search).get('team')?.trim() ?? ''
  } catch {
    return ''
  }
}

// Ask the backend to email an invite to a teammate
export async function sendInvite({ teamId, to, fromEmail }) {
  const response = await fetch(
    `/api/teams/${encodeURIComponent(teamId)}/invite`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, fromEmail }),
    },
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Could not send the invite.')
  }

  return data
}

// ws:// (or wss:// over https) endpoint for a team's live room
function teamSocketUrl(teamId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${window.location.host}/api/teams/${encodeURIComponent(
    teamId,
  )}/ws`
}

// Keeps a live connection to a team's room and mirrors the shared tasks,
// sprint settings, and member list. In solo mode (no teamId) it stays idle.
export function useTeamRoom({ teamId, email, enabled }) {
  const [todos, setTodosState] = useState(() => {
    const cached = readTeamCache(teamId)
    return Array.isArray(cached?.todos) ? cached.todos : []
  })
  const [config, setConfigState] = useState(
    () => readTeamCache(teamId)?.config ?? null,
  )
  const [members, setMembers] = useState([])
  const [status, setStatus] = useState('idle')

  const socketRef = useRef(null)
  const todosRef = useRef(todos)
  const emailRef = useRef(email)

  useEffect(() => {
    emailRef.current = email
  }, [email])

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
        socket.send(JSON.stringify({ type: 'join', email: emailRef.current }))
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
        setMembers(
          Array.isArray(message.state.members) ? message.state.members : [],
        )

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
    todos,
    config,
    members,
    setTodos,
    setConfig,
  }
}
