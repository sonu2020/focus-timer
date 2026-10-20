export const AMBIENCE_TRACKS = [
  { id: "off", label: "Off", hint: "silence" },
  { id: "rain", label: "Rain", hint: "steady rainfall" },
  { id: "waves", label: "Ocean", hint: "slow swells" },
  { id: "forest", label: "Forest", hint: "wind & birds" },
  { id: "brown", label: "Brown noise", hint: "deep rumble" },
  { id: "pink", label: "Pink noise", hint: "soft static" },
  { id: "focus", label: "Focus pad", hint: "calm chords" },
  // remove if unwanted
  {
    id: "drone",
    label: "Meditation drone",
    hint: "deep drone",
    file: "/audio/rooted-meditation-drone-cccaefcf.mp3",
    fallback: "focus",
  },
  // remove if unwanted
  {
    id: "techno",
    label: "Ambient techno",
    hint: "soft pulse",
    file: "/audio/pulsing-ambient-techno-dfd07da3.mp3",
    fallback: "focus",
  },
];

let ctx = null;
let master = null;
let current = null;
let currentId = "off";
let volume = 0.6;
const listeners = new Set();

export function getAmbienceId() {
  return currentId;
}

export function subscribeAmbience(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function setCurrentId(id) {
  if (currentId === id) return;
  currentId = id;
  listeners.forEach((listener) => listener());
}

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noiseBuffer(audio, type) {
  const length = audio.sampleRate * 4;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "pink") {
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }

  return buffer;
}

function noiseSource(audio, type) {
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer(audio, type);
  source.loop = true;
  return source;
}

function filter(audio, type, frequency, q = 0.7) {
  const node = audio.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function gainNode(audio, value) {
  const node = audio.createGain();
  node.gain.value = value;
  return node;
}

function lfo(audio, rate, depth, target) {
  const osc = audio.createOscillator();
  osc.frequency.value = rate;
  const amount = gainNode(audio, depth);
  osc.connect(amount);
  amount.connect(target);
  osc.start();
  return osc;
}

function stopAll(nodes) {
  return () => {
    nodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    });
  };
}

function combine(...stops) {
  return () => {
    stops.forEach((stop) => stop());
  };
}

/* ===== Nature and noise sounds ===== */

function rain(audio, out) {
  const source = noiseSource(audio, "pink");
  const high = filter(audio, "highpass", 500);
  const low = filter(audio, "lowpass", 6500);
  source.connect(high);
  high.connect(low);
  low.connect(gainNode(audio, 1.1)).connect(out);
  source.start();
  return stopAll([source]);
}

function waves(audio, out) {
  const source = noiseSource(audio, "brown");
  const low = filter(audio, "lowpass", 500);
  const swell = gainNode(audio, 0.55);
  source.connect(low);
  low.connect(swell);
  swell.connect(out);
  source.start();
  const slow = lfo(audio, 0.1, 0.35, swell.gain);
  const bright = lfo(audio, 0.1, 300, low.frequency);
  return stopAll([source, slow, bright]);
}

function forest(audio, out) {
  const wind = noiseSource(audio, "pink");
  const band = filter(audio, "bandpass", 600, 0.8);
  const windGain = gainNode(audio, 0.5);
  wind.connect(band);
  band.connect(windGain);
  windGain.connect(out);
  wind.start();
  const sway = lfo(audio, 0.07, 0.2, windGain.gain);

  let timer = null;
  function chirp() {
    const base = 2200 + Math.random() * 1800;
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const start = audio.currentTime + i * 0.18;
      const osc = audio.createOscillator();
      const env = gainNode(audio, 0);
      osc.type = "sine";
      osc.frequency.setValueAtTime(base, start);
      osc.frequency.exponentialRampToValueAtTime(base * 1.3, start + 0.12);
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.06, start + 0.03);
      env.gain.linearRampToValueAtTime(0, start + 0.15);
      osc.connect(env);
      env.connect(out);
      osc.start(start);
      osc.stop(start + 0.2);
    }
    timer = setTimeout(chirp, 1500 + Math.random() * 4500);
  }
  timer = setTimeout(chirp, 800);

  const stopNodes = stopAll([wind, sway]);
  return () => {
    clearTimeout(timer);
    stopNodes();
  };
}

function brown(audio, out) {
  const source = noiseSource(audio, "brown");
  source
    .connect(filter(audio, "lowpass", 900))
    .connect(gainNode(audio, 0.9))
    .connect(out);
  source.start();
  return stopAll([source]);
}

function pink(audio, out) {
  const source = noiseSource(audio, "pink");
  source.connect(gainNode(audio, 0.9)).connect(out);
  source.start();
  return stopAll([source]);
}

function focus(audio, out) {
  const notes = [110, 164.81, 220, 277.18, 329.63];
  const low = filter(audio, "lowpass", 900);
  const pad = gainNode(audio, 0.5);
  low.connect(pad);
  pad.connect(out);

  const nodes = [];
  notes.forEach((frequency, index) => {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.detune.value = (index % 2 === 0 ? 1 : -1) * 4;
    osc.connect(gainNode(audio, 0.1)).connect(low);
    osc.start();
    nodes.push(osc);
  });
  nodes.push(lfo(audio, 0.08, 0.15, pad.gain));
  nodes.push(lfo(audio, 0.05, 250, low.frequency));
  return stopAll(nodes);
}

/* ===== Cafe building blocks (generated fallback sounds) ===== */

function murmur(audio, out, level, muffled = false) {
  const layers = [
    { freq: 420, q: 0.9, rate: 0.31 },
    { freq: 800, q: 1.1, rate: 0.47 },
    { freq: 1300, q: 1.3, rate: 0.23 },
    { freq: 2000, q: 1.2, rate: 0.61 },
  ];
  const nodes = [];

  layers.forEach(({ freq, q, rate }) => {
    const source = noiseSource(audio, "pink");
    const band = filter(audio, "bandpass", muffled ? freq * 0.6 : freq, q);
    const base = level * 0.9;
    const gain = gainNode(audio, base);
    source.connect(band);
    band.connect(gain);
    gain.connect(out);
    source.start();
    nodes.push(source, lfo(audio, rate, base * 0.8, gain.gain));
  });

  return stopAll(nodes);
}

function clinks(audio, out, minMs, maxMs, peak) {
  const partials = [1, 2.76];
  let timer = null;

  function clink() {
    const start = audio.currentTime;
    const base = 2400 + Math.random() * 1800;

    partials.forEach((ratio, index) => {
      const osc = audio.createOscillator();
      const env = gainNode(audio, 0);
      osc.type = "sine";
      osc.frequency.value = base * ratio;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(peak / (index + 1), start + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(env);
      env.connect(out);
      osc.start(start);
      osc.stop(start + 0.4);
    });

    timer = setTimeout(clink, minMs + Math.random() * (maxMs - minMs));
  }

  timer = setTimeout(clink, 1200);
  return () => clearTimeout(timer);
}

function steam(audio, out, minMs, maxMs) {
  let timer = null;

  function burst() {
    const start = audio.currentTime;
    const length = 1.8 + Math.random() * 1.4;
    const source = noiseSource(audio, "pink");
    const high = filter(audio, "highpass", 3500);
    const env = gainNode(audio, 0);

    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(0.35, start + 0.25);
    env.gain.setValueAtTime(0.35, start + length - 0.6);
    env.gain.linearRampToValueAtTime(0, start + length);

    source.connect(high);
    high.connect(env);
    env.connect(out);
    source.start(start);
    source.stop(start + length + 0.1);

    timer = setTimeout(burst, minMs + Math.random() * (maxMs - minMs));
  }

  timer = setTimeout(burst, 2500);
  return () => clearTimeout(timer);
}

const JAZZ_CHORDS = [
  [146.83, 174.61, 220.0, 261.63], // Dm7
  [98.0, 174.61, 246.94, 293.66], // G7
  [130.81, 164.81, 196.0, 246.94], // Cmaj7
  [110.0, 164.81, 196.0, 261.63], // Am7
];

function jazz(audio, out) {
  const low = filter(audio, "lowpass", 1200);
  low.connect(out);

  let index = 0;
  let timer = null;

  function playChord() {
    const start = audio.currentTime;

    JAZZ_CHORDS[index % JAZZ_CHORDS.length].forEach((frequency) => {
      const osc = audio.createOscillator();
      const env = gainNode(audio, 0);
      osc.type = "triangle";
      osc.frequency.value = frequency;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.05, start + 0.4);
      env.gain.linearRampToValueAtTime(0, start + 3.8);
      osc.connect(env);
      env.connect(low);
      osc.start(start);
      osc.stop(start + 4);
    });

    index += 1;
    timer = setTimeout(playChord, 3600);
  }

  playChord();
  return () => clearTimeout(timer);
}

function cafeBusy(audio, out) {
  return combine(murmur(audio, out, 1.2), clinks(audio, out, 2500, 7000, 0.08));
}

function cafeQuiet(audio, out) {
  return combine(
    murmur(audio, out, 0.55, true),
    clinks(audio, out, 9000, 20000, 0.05),
  );
}

function cafeEspresso(audio, out) {
  return combine(
    murmur(audio, out, 0.9),
    steam(audio, out, 9000, 18000),
    clinks(audio, out, 4000, 9000, 0.07),
  );
}

function cafeRainy(audio, out) {
  const rainOut = gainNode(audio, 0.45);
  rainOut.connect(out);

  return combine(
    rain(audio, rainOut),
    murmur(audio, out, 0.5, true),
    clinks(audio, out, 9000, 18000, 0.04),
  );
}

function cafeJazz(audio, out) {
  return combine(
    murmur(audio, out, 0.45, true),
    jazz(audio, out),
    clinks(audio, out, 8000, 16000, 0.04),
  );
}

const BUILDERS = {
  rain,
  waves,
  forest,
  brown,
  pink,
  focus,
  "cafe-busy": cafeBusy,
  "cafe-quiet": cafeQuiet,
  "cafe-espresso": cafeEspresso,
  "cafe-rainy": cafeRainy,
  "cafe-jazz": cafeJazz,
};

/* ===== Real audio files ===== */

// Plays a file from public/ in a loop. If the file is missing or can't be
// played, it falls back to the generated sound with the given id.
function fileTrack(url, fallbackId) {
  return (audio, out) => {
    const element = new Audio(url);
    element.loop = true;
    element.preload = "auto";

    const source = audio.createMediaElementSource(element);
    source.connect(out);

    let stopFallback = null;
    let stopped = false;

    function useFallback() {
      const build = BUILDERS[fallbackId];
      if (stopped || stopFallback || !build) return;
      stopFallback = build(audio, out);
    }

    element.addEventListener("error", useFallback);
    element.play().catch(() => {});

    return () => {
      stopped = true;
      element.removeEventListener("error", useFallback);
      element.pause();
      element.removeAttribute("src");
      element.load();
      source.disconnect();
      if (stopFallback) stopFallback();
    };
  };
}

/* ===== Playback ===== */

function stopCurrent() {
  if (!current) return;
  const { out, cleanup } = current;
  current = null;
  const now = ctx.currentTime;
  out.gain.cancelScheduledValues(now);
  out.gain.setValueAtTime(out.gain.value, now);
  out.gain.linearRampToValueAtTime(0, now + 0.4);
  setTimeout(() => {
    cleanup();
    out.disconnect();
  }, 450);
}

export function playAmbience(id, options = {}) {
  if (id !== "off" && id === currentId) return;

  stopCurrent();

  if (id === "off") {
    setCurrentId("off");
    return;
  }

  const audio = getContext();
  const track = AMBIENCE_TRACKS.find((item) => item.id === id);
  const file = options.file ?? track?.file;
  const fallback = options.fallback ?? track?.fallback ?? id;
  const build = file ? fileTrack(file, fallback) : BUILDERS[fallback];

  if (!audio || !build) {
    setCurrentId("off");
    return;
  }

  const out = audio.createGain();
  out.gain.setValueAtTime(0, audio.currentTime);
  out.gain.linearRampToValueAtTime(1, audio.currentTime + 1);
  out.connect(master);

  current = { out, cleanup: build(audio, out) };
  setCurrentId(id);
}

export function setAmbienceVolume(value) {
  volume = Math.min(1, Math.max(0, value));
  if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}
