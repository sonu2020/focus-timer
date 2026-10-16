// Runs the Vite client and the Cloudflare Worker (Durable Object relay)
// together, so `bun run dev` gives a working collaboration environment.
import { spawn } from 'node:child_process'

const children = [
  spawn('wrangler', ['dev', '--port', '8787'], { stdio: 'inherit' }),
  spawn('vite', ['--host'], { stdio: 'inherit' }),
]

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }

  process.exit(code)
}

for (const child of children) {
  child.on('exit', (code) => shutdown(code ?? 0))
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
