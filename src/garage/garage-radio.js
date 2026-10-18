import { audio, soundOn } from '../audio/sfx.js';

// The garage radio: music that lives in one place in the 3D garage (the boombox on the cabinets).
// Walk toward it and it gets louder and brighter; walk away and it fades and dulls, as if heard
// through the room; it sits left or right of you depending on where it is. Its speaker cones pump
// with the level.
//   the track: Krish's own "F1" (public/assets/audio/garage/f1.mp3, 3 MB, fetched only when you get
//   out of the car). If it can't load, an original loop made right here in Web Audio plays instead.
//   it steps aside for the header's record player, mutes with the site's sound switch, dips while a
//   station is open and nearly stops for the radio check (which is about listening).
const TRACK = '/assets/audio/garage/f1.mp3';

export function createGarageRadio() {
  let ctx = null;
  let buffer = null;
  let loading = null;
  let src = null;
  let startedAt = 0;
  let offset = 0;
  let on = true; // the visitor's switch (click the radio, or M)
  let name = 'KV FM'; // the display, once the track is in
  const nodes = {};

  function graph() {
    ctx = audio();
    if (!ctx || nodes.master) return !!ctx;
    nodes.gain = ctx.createGain(); // proximity
    nodes.filter = ctx.createBiquadFilter(); // far away = through the room: the highs go first
    nodes.filter.type = 'lowpass';
    nodes.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    nodes.master = ctx.createGain(); // on / off, ducking, the site's sound switch
    nodes.analyser = ctx.createAnalyser();
    nodes.analyser.fftSize = 512;
    nodes.gain.gain.value = 0;
    nodes.master.gain.value = 0;
    nodes.gain.connect(nodes.filter).connect(nodes.pan).connect(nodes.master).connect(nodes.analyser).connect(ctx.destination);
    return true;
  }

  function load() {
    if (loading) return loading;
    loading = fetch(TRACK)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
      .then((b) => ctx.decodeAudioData(b))
      .then((b) => ((name = 'KV FM · F1'), b))
      .catch(() => renderLoop(ctx.sampleRate)) // (a missing or broken file: the made-here loop instead)
      .then((b) => (buffer = b));
    return loading;
  }

  function start() {
    if (!graph()) return;
    load().then(() => {
      if (src || !wanted) return;
      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(nodes.gain);
      src.start(0, offset % buffer.duration);
      startedAt = ctx.currentTime - (offset % buffer.duration);
    });
  }
  function stop() {
    if (!src) return;
    offset = ctx.currentTime - startedAt; // carry on from here next time
    const s = src;
    src = null;
    try {
      s.stop(ctx.currentTime + 0.7);
    } catch {
      /* already stopped */
    }
  }

  let wanted = false;
  const wave = new Uint8Array(256);
  let level = 0;
  // every frame while you're in the garage: where you are relative to the radio
  //   listener: { x, y, z, rx, rz } (position and the camera's right, flat); radio: { x, y, z }
  //   duck: 1 normal, lower while a station's open; inGarage: false fades it out and stops it
  function update(dt, { inGarage, listener, radio, duck = 1 }) {
    const record = document.documentElement.classList.contains('is-record-playing');
    const audible = inGarage && on && soundOn() && !record;
    if (audible && !wanted) {
      wanted = true;
      start();
    } else if (!inGarage && wanted) {
      wanted = false;
      setTimeout(() => !wanted && stop(), 800); // after the fade
    }
    if (!ctx || !nodes.master) return 0;
    const now = ctx.currentTime;
    nodes.master.gain.setTargetAtTime(audible ? duck : 0, now, audible ? 0.25 : 0.15);
    if (listener && radio) {
      const dx = radio.x - listener.x;
      const dz = radio.z - listener.z;
      const d = Math.hypot(dx, dz, (radio.y - listener.y) * 0.5);
      const near = 1 - smooth(1.2, 15, d); // 1 beside it, 0 across the garage and beyond
      nodes.gain.gain.setTargetAtTime(0.03 + 0.62 * near * near, now, 0.12);
      nodes.filter.frequency.setTargetAtTime(700 + 17000 * Math.pow(near, 1.6), now, 0.12);
      if (nodes.pan.pan) {
        const side = (dx * listener.rx + dz * listener.rz) / Math.max(0.001, Math.hypot(dx, dz)); // −1 left … 1 right
        nodes.pan.pan.setTargetAtTime(side * 0.75 * Math.min(1, d / 2), now, 0.1);
      }
    }
    // the level, for the cones
    if (src) {
      nodes.analyser.getByteTimeDomainData(wave);
      let sum = 0;
      for (let i = 0; i < wave.length; i++) sum += ((wave[i] - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / wave.length);
      level += (Math.min(1, rms * 14) - level) * Math.min(1, dt * 20);
    } else level *= 0.9;
    return level;
  }

  return {
    update,
    get on() {
      return on;
    },
    get label() {
      return on ? name : 'OFF';
    },
    toggle() {
      on = !on;
      if (!on && wanted) {
        wanted = false;
        setTimeout(() => !wanted && stop(), 800);
      }
      return on;
    },
  };
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- the fallback: 8 bars at 112 bpm, A minor (Am F C G), rendered once ----------
// Kick on every beat, a clap on 2 and 4, hats on the eighths, a bassline, a soft pad and a quiet
// arpeggio: an original garage-radio groove, for when the track can't load.
function renderLoop(rate) {
  const BPM = 112;
  const beat = 60 / BPM;
  const bars = 8;
  const len = bars * 4 * beat;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(2, Math.ceil(len * rate), rate);
  const bus = off.createGain();
  bus.gain.value = 0.85;
  const comp = off.createDynamicsCompressor();
  bus.connect(comp).connect(off.destination);
  const noiseBuf = off.createBuffer(1, rate, rate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const osc = (type, f, t, dur, peak, { to, a = 0.005, filter } = {}) => {
    const o = off.createOscillator();
    const g = off.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
    env(g, t, a, peak, dur);
    let node = o;
    if (filter) {
      const fl = off.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = filter;
      o.connect(fl);
      node = fl;
    }
    node.connect(g).connect(bus);
    o.start(t);
    o.stop(t + a + dur + 0.05);
  };
  const noise = (t, dur, peak, type, freq) => {
    const s = off.createBufferSource();
    s.buffer = noiseBuf;
    const f = off.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = off.createGain();
    env(g, t, 0.002, peak, dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  };
  // Am F C G (roots, then the chord tones above)
  const CHORDS = [
    [45, [57, 60, 64]],
    [41, [57, 60, 65]],
    [48, [55, 60, 64]],
    [43, [55, 59, 62]],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const [root, tones] = CHORDS[bar % 4];
    const t0 = bar * 4 * beat;
    // pad: the chord, slow in, detuned pairs
    tones.forEach((m) => [-6, 6].forEach((cents) => osc('sawtooth', hz(m) * Math.pow(2, cents / 1200), t0, 4 * beat - 0.1, 0.018, { a: 0.6, filter: 1400 })));
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      osc('sine', 150, t, 0.22, 0.9, { to: 45 }); // kick
      if (b % 2 === 1) noise(t, 0.16, 0.35, 'bandpass', 1500); // clap
      for (let e = 0; e < 2; e++) noise(t + e * beat * 0.5, 0.04, e ? 0.12 : 0.07, 'highpass', 8000); // hats
      // bass: root on the eighths, an octave hop on the offbeat
      osc('sawtooth', hz(root), t, beat * 0.42, 0.22, { filter: 420 });
      osc('sawtooth', hz(root + (b === 3 ? 7 : 12)), t + beat * 0.5, beat * 0.4, 0.16, { filter: 520 });
      // arpeggio on the sixteenths, quiet, every other bar
      if (bar % 2 === 1) for (let s16 = 0; s16 < 4; s16++) osc('square', hz(tones[(b * 4 + s16) % 3] + 12), t + s16 * beat * 0.25, beat * 0.18, 0.025, { filter: 2600 });
    }
  }
  return off.startRendering();
}
