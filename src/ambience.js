export const AMBIENCE_TRACKS = [
  { id: "off", label: "Off", hint: "silence" },
  { id: "rain", label: "Rain", hint: "steady rainfall" },
  { id: "waves", label: "Ocean", hint: "slow swells" },
  { id: "forest", label: "Forest", hint: "wind & birds" },
  { id: "brown", label: "Brown noise", hint: "deep rumble" },
  { id: "pink", label: "Pink noise", hint: "soft static" },
  { id: "focus", label: "Focus pad", hint: "calm chords" },
];

let ctx = null;
let master = null;
let current = null;
let volume = 0.6;

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

const BUILDERS = { rain, waves, forest, brown, pink, focus };

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

export function playAmbience(id) {
  stopCurrent();
  if (id === "off") return;

  const audio = getContext();
  const build = BUILDERS[id];
  if (!audio || !build) return;

  const out = audio.createGain();
  out.gain.setValueAtTime(0, audio.currentTime);
  out.gain.linearRampToValueAtTime(1, audio.currentTime + 1);
  out.connect(master);

  current = { out, cleanup: build(audio, out) };
}

export function setAmbienceVolume(value) {
  volume = Math.min(1, Math.max(0, value));
  if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}
