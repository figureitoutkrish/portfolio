import { audio } from './sfx.js';

// The radio check's player (data page, wheel.js → garage/radio-check.js). Each clip is a pair:
// the raw recording (a voice over gunfire, from the noise project's test set) and the model's
// output for it. Both play in lockstep and `mix` crossfades between them (equal power), so turning
// the dial is hearing the model take the gunfire out. Tiny AAC files in
// public/assets/audio/radio-check/<id>-raw.m4a and <id>-model.m4a.
const BASE = '/assets/audio/radio-check/';
const LEVEL = 0.5; // the raw clips peak at full scale (gunshots): keep them under the effects
const COLUMNS = 120; // waveform resolution for the display
const cache = new Map(); // id -> Promise<clip>

// loudest sample per column, for drawing
function peaks(buf) {
  const d = buf.getChannelData(0);
  const out = new Float32Array(COLUMNS);
  const step = d.length / COLUMNS;
  for (let i = 0; i < COLUMNS; i++) {
    let m = 0;
    for (let j = Math.floor(i * step), e = Math.floor((i + 1) * step); j < e; j++) m = Math.max(m, Math.abs(d[j]));
    out[i] = m;
  }
  return out;
}

export function loadClip(id) {
  if (!cache.has(id)) {
    const ctx = audio();
    if (!ctx) return Promise.reject(new Error('no web audio'));
    const get = (k) =>
      fetch(`${BASE}${id}-${k}.m4a`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${id}-${k}`))))
        .then((b) => ctx.decodeAudioData(b));
    const p = Promise.all([get('raw'), get('model')]).then(([raw, model]) => ({
      id,
      raw,
      model,
      duration: Math.min(raw.duration, model.duration),
      peaks: { raw: peaks(raw), model: peaks(model) },
    }));
    p.catch(() => cache.delete(id)); // a failed fetch can be retried
    cache.set(id, p);
  }
  return cache.get(id);
}

export function createPlayer() {
  let ctx = null;
  let voice = null; // { srcs, gains, out, clip, start, loop }
  let mix = 0;
  const levels = (m) => [Math.cos((m * Math.PI) / 2), Math.sin((m * Math.PI) / 2)];

  function stop() {
    if (!voice) return;
    const v = voice;
    voice = null;
    v.srcs.forEach((s) => {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* never started */
      }
    });
    v.out.disconnect();
  }

  // loop: the radio check (plays until stopped). sweep: a one-off call that starts raw and has the
  // model cut in after `sweep` seconds (the TALK button).
  function play(clip, { loop = true, sweep = null, onEnd } = {}) {
    stop();
    ctx = audio();
    if (!ctx) return false;
    const t = ctx.currentTime + 0.03;
    const out = ctx.createGain();
    out.gain.value = LEVEL;
    out.connect(ctx.destination);
    const start = sweep == null ? levels(mix) : [1, 0];
    const gains = start.map((v) => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(out);
      return g;
    });
    const srcs = [clip.raw, clip.model].map((buf, i) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = loop;
      s.loopEnd = clip.duration;
      s.connect(gains[i]);
      s.start(t);
      return s;
    });
    if (sweep != null) {
      gains[0].gain.setValueAtTime(1, t + sweep);
      gains[0].gain.linearRampToValueAtTime(0, t + sweep + 0.5);
      gains[1].gain.setValueAtTime(0, t + sweep);
      gains[1].gain.linearRampToValueAtTime(1, t + sweep + 0.5);
    }
    const v = { srcs, gains, out, clip, start: t, loop };
    if (!loop) {
      srcs[0].onended = () => {
        if (voice === v) stop();
        onEnd?.();
      };
    }
    voice = v;
    return true;
  }

  return {
    play,
    stop,
    get playing() {
      return !!voice;
    },
    get looping() {
      return !!voice?.loop;
    },
    get mix() {
      return mix;
    },
    setMix(m) {
      mix = Math.min(1, Math.max(0, m));
      if (!voice?.loop) return;
      const now = ctx.currentTime;
      levels(mix).forEach((v, i) => voice.gains[i].gain.setTargetAtTime(v, now, 0.012)); // no zipper clicks
    },
    // 0…1 through the clip that's playing
    position() {
      if (!voice) return 0;
      const el = Math.max(0, ctx.currentTime - voice.start);
      return voice.loop ? (el % voice.clip.duration) / voice.clip.duration : Math.min(1, el / voice.clip.duration);
    },
  };
}
