let ctx = null

function getContext() {
  if (typeof window === 'undefined') return null

  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
  }

  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Call from a user gesture (e.g. starting a sprint) so the browser lets us
// play the chime later, when the block ends without any interaction.
export function unlockBlockAudio() {
  getContext()
}

export function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') return

  Notification.requestPermission().catch(() => {})
}

function playBlockChime() {
  const audio = getContext()
  if (!audio) return

  const now = audio.currentTime
  const notes = [880, 1174.66]

  notes.forEach((frequency, index) => {
    const start = now + index * 0.18
    const osc = audio.createOscillator()
    const env = audio.createGain()

    osc.type = 'sine'
    osc.frequency.value = frequency
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(0.25, start + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.6)

    osc.connect(env)
    env.connect(audio.destination)

    osc.start(start)
    osc.stop(start + 0.65)
  })
}

export function notifyBlockEnd(
  title = 'Focus block complete',
  body = 'Time for the next block.',
) {
  playBlockChime()

  if (typeof Notification === 'undefined') return

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.svg' })
    } catch {
      // some browsers block the constructor; the chime still plays
    }
  }
}
