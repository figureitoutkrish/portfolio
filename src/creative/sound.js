// Retro sound effects, synthesised with Web Audio (no files to download). Off by default; the
// speaker in the Mac's menu bar (or ⌘K → "Sound") turns them on, and the choice is remembered.
// Apple's audio rules: causal (only on the thing you did), in sync (same frame as the visual),
// sparing (meaningful moments only: disk in/out, boot, game events, the mascot's horn).
const KEY = 'krish:sound';
let ctx = null;
let on = false;
const listeners = new Set();

try {
  on = localStorage.getItem(KEY) === 'on';
} catch {
  /* ignore */
}

export const soundOn = () => on;
export const onSoundChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function setSound(next) {
  on = next;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (on) audio(); // created inside the click that turned it on (browsers require a gesture)
  listeners.forEach((fn) => fn(on));
  if (on) sfx('click');
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, to, type = 'square', dur = 0.08, vol = 0.06, delay = 0 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.12, vol = 0.08, delay = 0, hp = 800 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = 'highpass';
  f.frequency.value = hp;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  click: () => tone({ freq: 1800, type: 'square', dur: 0.025, vol: 0.03 }),
  key: () => tone({ freq: 900, type: 'square', dur: 0.03, vol: 0.025 }),
  insert: () => {
    noise({ dur: 0.18, vol: 0.06, hp: 1200 });
    tone({ freq: 120, type: 'triangle', dur: 0.06, vol: 0.12, delay: 0.16 }); // the "chunk"
    tone({ freq: 2400, type: 'square', dur: 0.02, vol: 0.02, delay: 0.3 });
  },
  eject: () => {
    tone({ freq: 160, type: 'triangle', dur: 0.05, vol: 0.12 });
    noise({ dur: 0.14, vol: 0.05, hp: 1500, delay: 0.04 });
  },
  boot: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.9 - i * 0.1, vol: 0.05, delay: i * 0.02 })),
  off: () => tone({ freq: 600, to: 60, type: 'sine', dur: 0.25, vol: 0.05 }),
  alert: () => tone({ freq: 440, type: 'square', dur: 0.12, vol: 0.04 }),
  start: () => [440, 660, 880].forEach((f, i) => tone({ freq: f, dur: 0.07, vol: 0.04, delay: i * 0.08 })),
  crash: () => {
    noise({ dur: 0.4, vol: 0.12, hp: 200 });
    tone({ freq: 200, to: 40, type: 'sawtooth', dur: 0.35, vol: 0.05 });
  },
  score: () => [660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.09, vol: 0.035, delay: i * 0.07 })),
  honk: () => {
    tone({ freq: 392, type: 'square', dur: 0.09, vol: 0.05 });
    tone({ freq: 523, type: 'square', dur: 0.12, vol: 0.05, delay: 0.11 });
  },
};

export function sfx(name) {
  if (!on) return;
  try {
    SOUNDS[name]?.();
  } catch {
    /* audio is a bonus, never an error */
  }
}
