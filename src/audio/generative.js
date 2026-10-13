import { audio } from './sfx.js';

// The "Lo-fi focus" record: calm piano-and-pad music written live by the browser (Web Audio), in
// the spirit of a sandbox game's soundtrack but entirely original: no samples, no files, works
// offline, full length for everyone.
//
// Each piece is a seeded score: every bar is generated from (piece, bar number), so the same bar
// always sounds the same. That makes seeking and resuming after a page change exact.
//   piano: soft sine partials with a quick attack and a long, darker-as-it-fades decay
//   pad:   detuned saws through a low-pass filter, slow swell, changes every two bars
//   room:  a generated convolution reverb (no impulse file)

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const seeded = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// chords as semitones above the key's root
const C = { I: [0, 4, 7, 11], ii: [2, 5, 9, 12], iii: [4, 7, 11, 14], IV: [5, 9, 12, 16], V: [7, 11, 14, 17], Vsus: [7, 12, 14, 19], vi: [9, 12, 16, 19] };
const SCALE = [0, 2, 4, 7, 9, 11]; // major without the 4th: nothing ever clashes

export const PIECES = [
  { title: 'slow morning', root: 53, bpm: 64, bars: 52, seed: 11, chords: [C.I, C.iii, C.vi, C.IV], density: 0.34 },
  { title: 'first night', root: 50, bpm: 56, bars: 44, seed: 23, chords: [C.IV, C.I, C.Vsus, C.vi], density: 0.26 },
  { title: 'rain on glass', root: 48, bpm: 60, bars: 48, seed: 37, chords: [C.vi, C.IV, C.I, C.V], density: 0.3 },
  { title: 'oak and birch', root: 55, bpm: 70, bars: 56, seed: 51, chords: [C.I, C.IV, C.ii, C.Vsus], density: 0.4 },
].map((p) => ({ ...p, artist: 'made in code · krish’s machine', barDur: (4 * 60) / p.bpm, duration: (p.bars * 4 * 60) / p.bpm }));

function impulse(a, seconds) {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  return buf;
}

export function createGenerative({ onEnded } = {}) {
  let a = null;
  let out = null; // volume
  let bus = null; // into dry + reverb
  let session = null; // one per play, so pausing silences everything already scheduled
  let piece = PIECES[0];
  let playing = false;
  let zero = 0; // context time at which the piece's position was 0
  let offset = 0; // position while paused
  let nextBar = 0;
  let timer = 0;
  let volume = 0.7;

  function graph() {
    a = audio();
    if (!a || out) return a;
    out = a.createGain();
    out.gain.value = volume;
    const warm = a.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 5200;
    bus = a.createGain();
    const dry = a.createGain();
    dry.gain.value = 0.75;
    const verb = a.createConvolver();
    verb.buffer = impulse(a, 4);
    const wet = a.createGain();
    wet.gain.value = 0.6;
    bus.connect(dry).connect(warm);
    bus.connect(verb).connect(wet).connect(warm);
    // bring it up to the loudness of a streamed song, with a soft compressor to keep peaks tidy
    const boost = a.createGain();
    boost.gain.value = 3.2;
    const glue = a.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.knee.value = 12;
    glue.ratio.value = 3;
    glue.attack.value = 0.02;
    glue.release.value = 0.4;
    warm.connect(boost).connect(glue).connect(out).connect(a.destination);
    return a;
  }

  function piano(t, m, vel) {
    const f = mtof(m);
    const decay = Math.max(1.6, 3.6 - (m - 60) * 0.04);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900 + vel * 3200, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + decay); // darker as it fades, like a real string
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    lp.connect(g).connect(session);
    [
      [1, 1],
      [2, 0.42],
      [3, 0.16],
      [4, 0.07],
    ].forEach(([n, amp]) => {
      const o = a.createOscillator();
      o.frequency.value = f * n * (1 + (n - 1) * 0.0007); // a touch of piano-string stretch
      const pg = a.createGain();
      pg.gain.value = amp;
      o.connect(pg).connect(lp);
      o.start(t);
      o.stop(t + decay + 0.05);
    });
  }

  function pad(t, notes, dur) {
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 620;
    lp.Q.value = 0.4;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.022, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.018, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
    lp.connect(g).connect(session);
    notes.forEach((m) => {
      [-6, 6].forEach((cents) => {
        const o = a.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = cents;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 1.7);
      });
    });
  }

  // One bar of music, the same every time for (piece, bar).
  function scheduleBar(bar, t) {
    const p = piece;
    const rnd = seeded(p.seed * 1000 + bar);
    const chord = p.chords[Math.floor(bar / 2) % p.chords.length];
    const beat = p.barDur / 4;
    const ending = bar >= p.bars - 4;
    const fade = ending ? (p.bars - bar) / 5 : 1;

    if (bar % 2 === 0) pad(t, chord.map((s) => p.root + 12 + s), p.barDur * 2);
    if (bar < 2) return; // the pad sets the room first

    // left hand: the root low, sometimes the fifth on beat three
    piano(t, p.root - 12 + chord[0], 0.55 * fade);
    if (rnd() < 0.5) piano(t + beat * 2, p.root + chord[2] - (chord[2] > 12 ? 12 : 0), 0.38 * fade);

    // right hand: a slow random walk over the scale, leaning on chord tones
    let step = Math.floor(seeded(p.seed * 7 + Math.floor(bar / 4))() * 5) + 3;
    for (let i = 0; i < 8; i += 1) {
      if (rnd() > p.density * (i % 2 ? 0.7 : 1.2)) continue;
      step = Math.max(0, Math.min(11, step + Math.round((rnd() - 0.5) * 3)));
      let note = p.root + 12 + Math.floor(step / SCALE.length) * 12 + SCALE[step % SCALE.length];
      if (rnd() < 0.45) {
        // snap to the nearest chord tone
        const tones = chord.map((s) => p.root + 12 + s).flatMap((x) => [x, x + 12]);
        note = tones.reduce((b, x) => (Math.abs(x - note) < Math.abs(b - note) ? x : b), tones[0]);
      }
      const swing = i % 2 ? beat * 0.04 : 0;
      piano(t + (i * beat) / 2 + swing, note + 12, (0.35 + rnd() * 0.35) * fade);
      if (rnd() < 0.12) piano(t + (i * beat) / 2 + swing, note + 5 + 12, 0.25 * fade); // a soft fourth above, now and then
    }
    // every eighth bar, a little rising arpeggio to turn the phrase
    if (bar % 8 === 7 && !ending) chord.forEach((s, k) => piano(t + beat * 2 + k * beat * 0.4, p.root + 24 + s, 0.3));
  }

  const position = () => (playing && a ? Math.max(0, a.currentTime - zero) : offset);

  function tick() {
    const ahead = a.currentTime + 0.6;
    while (nextBar < piece.bars && zero + nextBar * piece.barDur < ahead) {
      const t = zero + nextBar * piece.barDur;
      if (t >= a.currentTime - 0.05) scheduleBar(nextBar, Math.max(t, a.currentTime + 0.02));
      nextBar += 1;
    }
    if (position() >= piece.duration + 2) {
      pause();
      offset = 0;
      onEnded?.();
    }
  }

  function play(at = offset) {
    if (!graph()) return false;
    if (a.state === 'suspended') a.resume().catch(() => {});
    stopSession();
    session = a.createGain();
    session.connect(bus);
    zero = a.currentTime + 0.05 - at;
    nextBar = Math.ceil(at / piece.barDur - 0.001);
    // starting mid-chord: bring the pad in right away so it isn't silent until the next bar
    const cur = Math.floor(at / piece.barDur);
    if (at > 0 && nextBar > cur) pad(a.currentTime + 0.05, piece.chords[Math.floor(cur / 2) % piece.chords.length].map((s) => piece.root + 12 + s), piece.barDur * 1.5);
    playing = true;
    clearInterval(timer);
    timer = setInterval(tick, 120);
    tick();
    return true;
  }
  function stopSession() {
    if (!session || !a) return;
    const s = session;
    s.gain.setTargetAtTime(0.0001, a.currentTime, 0.12);
    setTimeout(() => s.disconnect(), 800);
    session = null;
  }
  function pause() {
    offset = position();
    playing = false;
    clearInterval(timer);
    stopSession();
  }

  return {
    load(index) {
      const was = playing;
      if (was) pause();
      piece = PIECES[index] || PIECES[0];
      offset = 0;
      if (was) play(0);
    },
    play,
    pause,
    seek(s) {
      const at = Math.max(0, Math.min(piece.duration, s));
      if (playing) play(at);
      else offset = at;
    },
    setVolume(v) {
      volume = v;
      if (out) out.gain.setTargetAtTime(v, a.currentTime, 0.05);
    },
    fadeOut(seconds) {
      if (out) out.gain.setTargetAtTime(0.0001, a.currentTime, seconds / 3);
    },
    position,
    get duration() {
      return piece.duration;
    },
    get playing() {
      return playing;
    },
  };
}
