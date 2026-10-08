export const AMBIENCE_TRACKS = [
  { id: 'off', label: 'Off', hint: 'silence' },
  { id: 'rain', label: 'Rain', hint: 'steady rainfall' },
  { id: 'waves', label: 'Ocean', hint: 'slow swells' },
  { id: 'forest', label: 'Forest', hint: 'wind & birds' },
  { id: 'brown', label: 'Brown noise', hint: 'deep rumble' },
  { id: 'pink', label: 'Pink noise', hint: 'soft static' },
  { id: 'focus', label: 'Focus pad', hint: 'calm chords' },
]

const FADE_IN = 0.6
const FADE_OUT = 0.35
const NOISE_SECONDS = 4

const MELODY = [
  220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25,
]

let ctx = null
let master = null
let volume = 0.6
let active = null

const noiseCache = {}

function ensureContext() {
  const Ctor =
    typeof window !== 'undefined'
      ? window.AudioContext || window.webkitAudioContext
      : null

  if (!Ctor) return null

  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = volume
    master.connect(ctx.destination)
  }

  if (ctx.state === 'suspended') ctx.resume()

  return ctx
}

function crossfadeLoop(data, sampleRate) {
  const n = Math.min(
    Math.floor(sampleRate * 0.05),
    Math.floor(data.length / 4),
  )

  for (let i = 0; i < n; i++) {
    const t = i / n
    const tail = data.length - n + i
    data[tail] = data[tail] * (1 - t) + data[i] * t
  }
}

function getNoise(ac, kind) {
  if (noiseCache[kind]) return noiseCache[kind]

  const length = Math.floor(ac.sampleRate * NOISE_SECONDS)
  const buffer = ac.createBuffer(1, length, ac.sampleRate)
  const data = buffer.getChannelData(0)

  if (kind === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
  } else if (kind === 'brown') {
    let last = 0

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
  } else {
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
  }

  crossfadeLoop(data, ac.sampleRate)

  noiseCache[kind] = buffer
  return buffer
}

function layer(t, options) {
  const { ac, out } = t
  const gain = options.gain ?? 1

  const source = ac.createBufferSource()
  source.buffer = getNoise(ac, options.kind || 'white')
  source.loop = true

  const filter = ac.createBiquadFilter()
  filter.type = options.type || 'lowpass'
  filter.frequency.value = options.frequency || 1000
  filter.Q.value = options.q || 0.7

  const amp = ac.createGain()
  amp.gain.value = gain

  source.connect(filter).connect(amp).connect(out)
  source.start(ac.currentTime, Math.random() * 3)

  t.sources.push(source)
  t.nodes.push(source, filter, amp)

  if (options.swell) {
    const lfo = ac.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = options.swell.rate

    const depth = ac.createGain()
    depth.gain.value = (options.swell.depth ?? 0.3) * gain

    lfo.connect(depth).connect(amp.gain)
    lfo.start()

    t.sources.push(lfo)
    t.nodes.push(lfo, depth)
  }

  return { source, filter, amp }
}

function buildRain(t) {
  layer(t, {
    kind: 'white',
    type: 'lowpass',
    frequency: 2000,
    gain: 0.4,
    swell: { rate: 0.07, depth: 0.22 },
  })
  layer(t, { kind: 'white', type: 'highpass', frequency: 2400, gain: 0.14 })
  layer(t, { kind: 'brown', type: 'lowpass', frequency: 420, gain: 0.3 })
}

function buildWaves(t) {
  layer(t, {
    kind: 'brown',
    type: 'lowpass',
    frequency: 320,
    gain: 0.5,
    swell: { rate: 0.085, depth: 0.7 },
  })
  layer(t, {
    kind: 'white',
    type: 'lowpass',
    frequency: 1100,
    gain: 0.13,
    swell: { rate: 0.085, depth: 0.75 },
  })
  layer(t, {
    kind: 'brown',
    type: 'lowpass',
    frequency: 170,
    gain: 0.3,
    swell: { rate: 0.043, depth: 0.6 },
  })
}

function buildBrown(t) {
  layer(t, {
    kind: 'brown',
    type: 'lowpass',
    frequency: 640,
    gain: 0.7,
    swell: { rate: 0.05, depth: 0.1 },
  })
  layer(t, { kind: 'brown', type: 'lowpass', frequency: 160, gain: 0.32 })
}

function buildPink(t) {
  layer(t, { kind: 'pink', type: 'lowpass', frequency: 5200, gain: 0.5 })
  layer(t, { kind: 'pink', type: 'highpass', frequency: 120, gain: 0.25 })
}

function chirp(t) {
  const { ac, out } = t
  const now = ac.currentTime

  const osc = ac.createOscillator()
  osc.type = Math.random() < 0.5 ? 'sine' : 'triangle'

  const base = 1500 + Math.random() * 1600
  osc.frequency.setValueAtTime(base, now)
  osc.frequency.exponentialRampToValueAtTime(
    base * (1.25 + Math.random() * 0.5),
    now + 0.07,
  )
  osc.frequency.exponentialRampToValueAtTime(
    base * (0.85 + Math.random() * 0.2),
    now + 0.16,
  )

  const amp = ac.createGain()
  amp.gain.setValueAtTime(0.0001, now)
  amp.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

  osc.connect(amp).connect(out)
  osc.start(now)
  osc.stop(now + 0.32)
  osc.onended = () => {
    try {
      amp.disconnect()
    } catch {
      return
    }
  }
}

function scheduleChirps(t) {
  t.later(() => {
    const count = 1 + Math.floor(Math.random() * 3)

    for (let i = 0; i < count; i++) {
      t.later(() => chirp(t), i * (140 + Math.random() * 160))
    }

    scheduleChirps(t)
  }, 900 + Math.random() * 2600)
}

function buildForest(t) {
  layer(t, {
    kind: 'brown',
    type: 'lowpass',
    frequency: 560,
    gain: 0.38,
    swell: { rate: 0.04, depth: 0.55 },
  })
  layer(t, {
    kind: 'pink',
    type: 'lowpass',
    frequency: 3400,
    gain: 0.15,
    swell: { rate: 0.13, depth: 0.5 },
  })

  scheduleChirps(t)
}

function playNote(t) {
  const { ac } = t
  const now = ac.currentTime

  let index = Math.floor(Math.random() * MELODY.length)
  if (index === t.lastNote) index = (index + 1) % MELODY.length
  t.lastNote = index

  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = MELODY[index]

  const amp = ac.createGain()
  amp.gain.setValueAtTime(0.0001, now)
  amp.gain.exponentialRampToValueAtTime(0.15, now + 0.35)
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)

  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2200

  osc.connect(amp).connect(tone)
  tone.connect(t.bus)
  tone.connect(t.send)

  osc.start(now)
  osc.stop(now + 3.4)
  osc.onended = () => {
    try {
      tone.disconnect()
      amp.disconnect()
    } catch {
      return
    }
  }
}

function scheduleNote(t) {
  t.later(() => {
    playNote(t)
    scheduleNote(t)
  }, 2600 + Math.random() * 2400)
}

function buildFocus(t) {
  const { ac, out } = t

  const bus = ac.createGain()
  bus.gain.value = 1

  const tone = ac.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1100
  tone.Q.value = 0.4

  bus.connect(tone).connect(out)

  const cutoffLfo = ac.createOscillator()
  cutoffLfo.type = 'sine'
  cutoffLfo.frequency.value = 0.05

  const cutoffDepth = ac.createGain()
  cutoffDepth.gain.value = 350

  cutoffLfo.connect(cutoffDepth).connect(tone.frequency)
  cutoffLfo.start()

  const chord = [
    { f: 110, g: 0.1, type: 'sine' },
    { f: 164.81, g: 0.085, type: 'sine' },
    { f: 261.63, g: 0.07, type: 'triangle' },
    { f: 329.63, g: 0.055, type: 'triangle' },
    { f: 440, g: 0.035, type: 'sine' },
  ]

  chord.forEach((voice, index) => {
    const osc = ac.createOscillator()
    osc.type = voice.type
    osc.frequency.value = voice.f
    osc.detune.value = index % 2 ? 5 : -5

    const amp = ac.createGain()
    amp.gain.value = voice.g

    const tremolo = ac.createOscillator()
    tremolo.type = 'sine'
    tremolo.frequency.value = 0.06 + index * 0.017

    const tremoloDepth = ac.createGain()
    tremoloDepth.gain.value = voice.g * 0.35

    tremolo.connect(tremoloDepth).connect(amp.gain)
    tremolo.start()

    osc.connect(amp).connect(bus)
    osc.start()

    t.sources.push(osc, tremolo)
    t.nodes.push(osc, tremolo, amp, tremoloDepth)
  })

  const delay = ac.createDelay(1)
  delay.delayTime.value = 0.42

  const feedback = ac.createGain()
  feedback.gain.value = 0.32

  const wet = ac.createGain()
  wet.gain.value = 0.45

  delay.connect(feedback).connect(delay)
  delay.connect(wet).connect(out)

  t.bus = bus
  t.send = delay
  t.nodes.push(bus, tone, cutoffLfo, cutoffDepth, delay, feedback, wet)

  scheduleNote(t)
}

const BUILDERS = {
  rain: buildRain,
  waves: buildWaves,
  forest: buildForest,
  brown: buildBrown,
  pink: buildPink,
  focus: buildFocus,
}

function stopActive(fade = FADE_OUT) {
  if (!active || !ctx) return

  const track = active
  active = null
  track.stopped = true
  track.timers.forEach(clearTimeout)
  track.timers.length = 0

  const now = ctx.currentTime

  try {
    if (track.out.gain.cancelAndHoldAtTime) {
      track.out.gain.cancelAndHoldAtTime(now)
    } else {
      track.out.gain.cancelScheduledValues(now)
      track.out.gain.setValueAtTime(1, now)
    }

    track.out.gain.linearRampToValueAtTime(0.0001, now + fade)
  } catch {
    return
  }

  setTimeout(() => {
    track.sources.forEach((source) => {
      try {
        source.stop()
      } catch {
        return
      }
    })

    track.nodes.forEach((node) => {
      try {
        node.disconnect()
      } catch {
        return
      }
    })

    try {
      track.out.disconnect()
    } catch {
      return
    }
  }, (fade + 0.05) * 1000)
}

export function playAmbience(id) {
  const builder = BUILDERS[id]

  if (!builder) {
    stopActive()
    return
  }

  const ac = ensureContext()
  if (!ac) return

  stopActive(0.25)

  const out = ac.createGain()
  out.gain.value = 0.0001
  out.connect(master)

  const track = {
    ac,
    out,
    stopped: false,
    lastNote: -1,
    bus: null,
    send: null,
    sources: [],
    nodes: [out],
    timers: [],
    later(fn, ms) {
      const timer = setTimeout(fn, ms)
      track.timers.push(timer)
      return timer
    },
  }

  builder(track)

  const now = ac.currentTime
  out.gain.setValueAtTime(0.0001, now)
  out.gain.linearRampToValueAtTime(1, now + FADE_IN)

  active = track
}

export function stopAmbience() {
  stopActive()
}

export function setAmbienceVolume(value) {
  volume = Math.min(1, Math.max(0, value))

  if (master && ctx) {
    master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05)
  }
}
