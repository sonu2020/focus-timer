import { DurableObject } from 'cloudflare:workers'

// Where a room's shared tasks and sprint settings are persisted in the
// Durable Object's storage, so they survive hibernation and restarts.
const ROOM_STORAGE_KEY = 'room'

// One Durable Object instance per team/room. It holds the shared tasks and
// sprint settings and relays every change to everyone connected over
// WebSockets.
export class TeamRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)

    this.room = { todos: [], config: null }

    // Load any previously saved room state before handling events
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get(ROOM_STORAGE_KEY)
      if (saved && typeof saved === 'object') {
        this.room = {
          todos: Array.isArray(saved.todos) ? saved.todos : [],
          config: saved.config ?? null,
        }
      }
    })
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade')
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Hibernation API: the room can sleep without dropping connections
    this.ctx.acceptWebSocket(server)

    // Send the current room state as soon as the connection opens
    server.send(JSON.stringify({ state: this.publicState() }))

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(_ws, message) {
    if (typeof message !== 'string') return

    let payload
    try {
      payload = JSON.parse(message)
    } catch {
      return
    }

    if (!payload || typeof payload.type !== 'string') return

    if (payload.type === 'setTodos' && Array.isArray(payload.todos)) {
      await this.persist({ todos: payload.todos })
      this.broadcast()
      return
    }

    if (payload.type === 'setConfig' && payload.config) {
      await this.persist({ config: payload.config })
      this.broadcast()
    }
  }

  // The shared snapshot sent to every connected client
  publicState() {
    return {
      todos: this.room.todos,
      config: this.room.config,
    }
  }

  async persist(patch) {
    this.room = { ...this.room, ...patch }
    await this.ctx.storage.put(ROOM_STORAGE_KEY, this.room)
  }

  broadcast() {
    const message = JSON.stringify({ state: this.publicState() })

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message)
      } catch {
        // The socket may have closed between events; ignore it
      }
    }
  }
}

function readTeamId(pathname) {
  const match = pathname.match(/^\/api\/teams\/([^/]+)\/ws$/)

  return match ? decodeURIComponent(match[1]) : ''
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const teamId = readTeamId(url.pathname)

    if (!teamId) {
      return new Response('Not Found', { status: 404 })
    }

    const upgrade = request.headers.get('Upgrade')
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    const id = env.TEAM_ROOMS.idFromName(teamId)
    return env.TEAM_ROOMS.get(id).fetch(request)
  },
}
