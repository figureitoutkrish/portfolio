// Sound effects for the whole site, synthesised with Web Audio (no files to download).
//
// On by default from the visitor's first click or key press (browsers only allow audio after a
// gesture). Turning it off (record player, the Mac's speaker or ⌘K → Sound) is remembered.
//
// Each page sounds like itself (html[data-sound]):
//   glass   home: soft, airy ticks and pops, like Apple's UI sounds
//   digital data: small square-wave blips
//   retro   creative: chiptune bleeps for the Mac, plus physical sounds (paper, stickers, the can)
// Shared names (tap, open, close, toggle, whoosh) map to each theme's own version; page-specific
// names (insert, crash, peel…) live in the theme that uses them, and fall back to `tap`.
// Apple's audio rules: causal (only on the thing you did), in sync (same frame as the visual),
// sparing (meaningful moments, never every hover).
const KEY = 'krish:sound';
let ctx = null;
let out = null; // master gain for effects
let on = false;
let pref = null; // 'on' | 'off' | null (never chosen)
const listeners = new Set();

try {
  pref = localStorage.getItem(KEY);
} catch {
  /* ignore */
}
on = pref === 'on';

export const soundOn = () => on;
export const onSoundChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function setSound(next, { remember = true } = {}) {
  on = next;
  if (remember) {
    pref = on ? 'on' : 'off';
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* ignore */
    }
  }
  if (on) audio(); // created inside the gesture that turned it on
  listeners.forEach((fn) => fn(on));
  if (on && remember) sfx('toggle');
}

// First click / key anywhere: switch on, unless the visitor turned sound off before.
function unlock() {
  document.removeEventListener('pointerdown', unlock, true);
  document.removeEventListener('keydown', unlock, true);
  if (pref === 'off') return;
  if (!on) setSound(true, { remember: false });
  else audio();
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  // background tab: silence everything (the engine hum, crackle) until you come back
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

export function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 1;
    out.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// ---------- building blocks ----------
function tone({ freq = 440, to, type = 'square', dur = 0.08, vol = 0.06, delay = 0, attack = 0.002 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
const whiteNoise = (a) => {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
};

// Filtered noise burst; `from`/`to` sweep the filter (whooshes, rustles, fizz).
function noise({ dur = 0.12, vol = 0.08, delay = 0, type = 'highpass', freq = 800, to, q = 0.8, attack = 0.004 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = whiteNoise(a);
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

// ---------- themes ----------
const THEMES = {
  glass: {
    tap: () => tone({ freq: 1750, type: 'sine', dur: 0.04, vol: 0.035 }),
    open: () => {
      tone({ freq: 620, to: 880, type: 'sine', dur: 0.09, vol: 0.04 });
      noise({ dur: 0.08, vol: 0.012, type: 'bandpass', freq: 4000, q: 1.2 });
    },
    close: () => tone({ freq: 880, to: 600, type: 'sine', dur: 0.08, vol: 0.035 }),
    toggle: () => [990, 1320].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.06, vol: 0.03, delay: i * 0.05 })),
    whoosh: () => noise({ dur: 0.7, vol: 0.05, type: 'bandpass', freq: 300, to: 2400, q: 0.7, attack: 0.25 }),
  },
  digital: {
    tap: () => tone({ freq: 1400, type: 'square', dur: 0.025, vol: 0.022 }),
    open: () => [880, 1320].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.03, vol: 0.022, delay: i * 0.035 })),
    close: () => [1320, 880].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.03, vol: 0.022, delay: i * 0.035 })),
    toggle: () => tone({ freq: 2000, type: 'square', dur: 0.02, vol: 0.02 }),
    whoosh: () => noise({ dur: 0.6, vol: 0.04, type: 'lowpass', freq: 200, to: 5000, q: 6, attack: 0.2 }),
    // the data page's car
    ignition: () => {
      // starter motor whirr, then the engine catches
      noise({ dur: 0.55, vol: 0.05, type: 'bandpass', freq: 900, to: 1600, q: 3, attack: 0.05 });
      tone({ freq: 70, to: 140, type: 'sawtooth', dur: 0.5, vol: 0.05, attack: 0.05 });
      tone({ freq: 180, to: 95, type: 'sawtooth', dur: 0.35, vol: 0.07, delay: 0.5 });
      noise({ dur: 0.25, vol: 0.06, type: 'lowpass', freq: 600, delay: 0.5 });
    },
    shift: () => {
      // a quick cut and a crack from the exhaust
      noise({ dur: 0.05, vol: 0.06, type: 'bandpass', freq: 1800, q: 1.4 });
      tone({ freq: 140, to: 90, type: 'square', dur: 0.05, vol: 0.03 });
    },
    clunk: () => {
      tone({ freq: 95, to: 60, type: 'triangle', dur: 0.09, vol: 0.09 });
      noise({ dur: 0.05, vol: 0.04, type: 'bandpass', freq: 2400, q: 2 });
    },
    limiter: () => tone({ freq: 1760, type: 'square', dur: 0.04, vol: 0.016 }),
    airgun: () => {
      // a wheel gun: a hard rattle, then the hiss
      for (let i = 0; i < 6; i++) noise({ dur: 0.03, vol: 0.07, type: 'bandpass', freq: 2600, q: 2, delay: i * 0.035 });
      noise({ dur: 0.3, vol: 0.03, type: 'highpass', freq: 4000, delay: 0.22 });
    },
    lightbank: () => {
      tone({ freq: 60, type: 'sine', dur: 0.18, vol: 0.06 });
      noise({ dur: 0.06, vol: 0.05, type: 'bandpass', freq: 3000, q: 3 });
    },
    radio: () => {
      noise({ dur: 0.18, vol: 0.05, type: 'bandpass', freq: 1800, q: 1 });
      tone({ freq: 1200, type: 'sine', dur: 0.06, vol: 0.025, delay: 0.16 });
    },
  },
  retro: {
    tap: () => tone({ freq: 1800, type: 'square', dur: 0.025, vol: 0.03 }),
    click: () => tone({ freq: 1800, type: 'square', dur: 0.025, vol: 0.03 }),
    open: () => [523, 784].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.05, vol: 0.03, delay: i * 0.05 })),
    close: () => [784, 523].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.05, vol: 0.03, delay: i * 0.05 })),
    toggle: () => tone({ freq: 1800, type: 'square', dur: 0.025, vol: 0.03 }),
    whoosh: () => noise({ dur: 0.6, vol: 0.05, type: 'bandpass', freq: 400, to: 3000, q: 0.9, attack: 0.2 }),
    key: () => tone({ freq: 900, type: 'square', dur: 0.03, vol: 0.025 }),
    insert: () => {
      noise({ dur: 0.18, vol: 0.06, freq: 1200 });
      tone({ freq: 120, type: 'triangle', dur: 0.06, vol: 0.12, delay: 0.16 }); // the "chunk"
      tone({ freq: 2400, type: 'square', dur: 0.02, vol: 0.02, delay: 0.3 });
    },
    eject: () => {
      tone({ freq: 160, type: 'triangle', dur: 0.05, vol: 0.12 });
      noise({ dur: 0.14, vol: 0.05, freq: 1500, delay: 0.04 });
    },
    boot: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.9 - i * 0.1, vol: 0.05, delay: i * 0.02 })),
    off: () => tone({ freq: 600, to: 60, type: 'sine', dur: 0.25, vol: 0.05 }),
    alert: () => tone({ freq: 440, type: 'square', dur: 0.12, vol: 0.04 }),
    start: () => [440, 660, 880].forEach((f, i) => tone({ freq: f, dur: 0.07, vol: 0.04, delay: i * 0.08 })),
    crash: () => {
      noise({ dur: 0.4, vol: 0.12, freq: 200 });
      tone({ freq: 200, to: 40, type: 'sawtooth', dur: 0.35, vol: 0.05 });
    },
    score: () => [660, 880, 1320].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.09, vol: 0.035, delay: i * 0.07 })),
    honk: () => {
      tone({ freq: 392, type: 'square', dur: 0.09, vol: 0.05 });
      tone({ freq: 523, type: 'square', dur: 0.12, vol: 0.05, delay: 0.11 });
    },
    // start lights: three reds, then green
    beep: () => tone({ freq: 660, type: 'square', dur: 0.12, vol: 0.035 }),
    go: () => tone({ freq: 1320, type: 'square', dur: 0.3, vol: 0.04 }),
    lap: () => [880, 1320, 1760].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.05, delay: i * 0.06 })),
    // physical things on the desk
    pick: () => noise({ dur: 0.07, vol: 0.05, type: 'bandpass', freq: 3200, q: 1.5 }), // paper lifted
    drop: () => {
      noise({ dur: 0.09, vol: 0.07, type: 'lowpass', freq: 1800, q: 0.7 }); // slapped down
      tone({ freq: 110, to: 70, type: 'sine', dur: 0.08, vol: 0.06 });
    },
    peel: () => noise({ dur: 0.16, vol: 0.05, type: 'bandpass', freq: 700, to: 5000, q: 2.5, attack: 0.03 }),
    flip: () => {
      noise({ dur: 0.06, vol: 0.05, type: 'bandpass', freq: 2600, q: 1.2 });
      noise({ dur: 0.07, vol: 0.04, type: 'bandpass', freq: 3600, q: 1.2, delay: 0.09 });
    },
    mrrp: () => {
      // a tiny chirpy "mrrp": warbling sine up then down
      const a = audio();
      if (!a) return;
      const t = a.currentTime;
      const o = a.createOscillator();
      const lfo = a.createOscillator();
      const depth = a.createGain();
      const g = a.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(780, t + 0.09);
      o.frequency.linearRampToValueAtTime(600, t + 0.22);
      lfo.frequency.value = 32;
      depth.gain.value = 40;
      lfo.connect(depth).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g).connect(out);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.26);
      lfo.stop(t + 0.26);
    },
    fizz: () => {
      noise({ dur: 0.05, vol: 0.09, type: 'bandpass', freq: 1500, q: 2 }); // the tab pops
      noise({ dur: 0.45, vol: 0.04, type: 'highpass', freq: 5000, delay: 0.04, attack: 0.02 }); // fizz
    },
    shave: () => noise({ dur: 0.2, vol: 0.05, type: 'bandpass', freq: 2500, to: 600, q: 1.4, attack: 0.02 }), // a car whips past
  },
};

const theme = () => THEMES[document.documentElement.dataset.sound] || THEMES.glass;

export function sfx(name) {
  if (!on) return;
  try {
    const t = theme();
    (t[name] || THEMES.retro[name] || t.tap)();
  } catch {
    /* audio is a bonus, never an error */
  }
}

// Continuous sounds (the racer's engine, the data page's F1 car, a pencil on paper).
// Returns { set(value), stop() }.
export function loop(name) {
  const a = on ? audio() : null;
  if (!a) return { set() {}, stop() {} };
  const t = a.currentTime;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.connect(out);
  let nodes = [];
  let set = () => {};
  if (name === 'engine') {
    const o = a.createOscillator();
    const sub = a.createOscillator();
    const f = a.createBiquadFilter();
    o.type = 'sawtooth';
    sub.type = 'square';
    f.type = 'lowpass';
    f.frequency.value = 600;
    o.connect(f);
    sub.connect(f);
    f.connect(g);
    nodes = [o, sub];
    set = (v) => {
      const now = a.currentTime;
      o.frequency.setTargetAtTime(55 + v * 110, now, 0.08);
      sub.frequency.setTargetAtTime(27.5 + v * 55, now, 0.08);
      f.frequency.setTargetAtTime(400 + v * 1400, now, 0.1);
    };
    g.gain.exponentialRampToValueAtTime(0.025, t + 0.3);
  } else if (name === 'f1') {
    // a V6 turbo, roughly: firing frequency = rpm / 60 × 3. Saw + sub square through a soft
    // clipper and a lowpass that opens with load, plus a little intake noise.
    // set({ rpm, load 0…1, cut }) — cut = the pit limiter chopping the ignition
    const o = a.createOscillator();
    const o2 = a.createOscillator();
    const sub = a.createOscillator();
    const clip = a.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    clip.curve = curve;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    const src = a.createBufferSource();
    src.buffer = whiteNoise(a);
    src.loop = true;
    const nf = a.createBiquadFilter();
    nf.type = 'bandpass';
    nf.Q.value = 1.2;
    const ng = a.createGain();
    ng.gain.value = 0.25;
    o.type = 'sawtooth';
    o2.type = 'sawtooth';
    o2.detune.value = 14;
    sub.type = 'square';
    const mix = a.createGain();
    mix.gain.value = 0.5;
    [o, o2, sub].forEach((n) => n.connect(mix));
    mix.connect(clip).connect(f).connect(g);
    src.connect(nf).connect(ng).connect(g);
    nodes = [o, o2, sub, src];
    set = ({ rpm = 4000, load = 0, cut = false } = {}) => {
      const now = a.currentTime;
      const fire = (rpm / 60) * 3;
      o.frequency.setTargetAtTime(fire, now, 0.04);
      o2.frequency.setTargetAtTime(fire * 1.5, now, 0.04);
      sub.frequency.setTargetAtTime(fire / 2, now, 0.04);
      f.frequency.setTargetAtTime(500 + load * 2600 + rpm * 0.12, now, 0.06);
      nf.frequency.setTargetAtTime(fire * 4, now, 0.06);
      g.gain.setTargetAtTime(cut ? 0.008 : 0.022 + load * 0.03, now, cut ? 0.008 : 0.05);
    };
    g.gain.exponentialRampToValueAtTime(0.022, t + 0.4);
  } else if (name === 'pencil') {
    const src = a.createBufferSource();
    src.buffer = whiteNoise(a);
    src.loop = true;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 5200;
    f.Q.value = 1.4;
    src.connect(f).connect(g);
    nodes = [src];
    set = (v) => g.gain.setTargetAtTime(0.0001 + Math.min(1, v) * 0.03, a.currentTime, 0.03); // louder when drawing faster
  }
  nodes.forEach((n) => n.start(t));
  return {
    set: (v) => {
      try {
        set(v);
      } catch {
        /* ignore */
      }
    },
    stop() {
      const now = a.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.06);
      nodes.forEach((n) => n.stop(now + 0.3));
    },
  };
}
