import { LAYOUT } from './layout.js';

// The visitor's drive in, recorded like a real lap: 10 samples a second plus the moments that
// matter (the pit entry line, the limiter, the stop at the box). The wheel's LAP mode shows it.
// Nothing leaves the browser: it lives in sessionStorage for this visit only.
// Pure (no DOM besides storage), so summarize() can be checked in Node.
const KEY = 'krish:lap';
const RATE = 0.1; // seconds between samples

export function createRecorder() {
  let rec = null;
  let last = null; // the finished lap, until the next one starts
  let since = 0;
  return {
    // the moments so far (live HUD: the sector box grades from these)
    get marks() {
      return (rec || last)?.marks || {};
    },
    start() {
      last = null;
      rec = { t: 0, samples: [], marks: {}, corrections: 0, lastSteer: 0 };
      since = RATE;
    },
    // called every frame while driving
    frame(dt, s, input) {
      if (!rec || s.mode !== 'drive') return;
      rec.t += dt;
      const t = rec.t;
      const braking = input.brake > 0;
      if (braking && rec.marks.brake == null) rec.marks.brake = { t, z: s.z, kph: s.kph };
      // a correction = the steering changes side with some intent
      const st = input.steer;
      if (Math.abs(st) > 0.3 && Math.sign(st) !== Math.sign(rec.lastSteer)) rec.corrections++;
      if (Math.abs(st) > 0.3) rec.lastSteer = st;
      since += dt;
      if (since >= RATE) {
        since = 0;
        rec.samples.push([+t.toFixed(2), +s.z.toFixed(1), +s.kph.toFixed(1), input.throttle ? 1 : 0, braking ? 1 : 0, s.limiter ? 1 : 0]);
      }
    },
    mark(name, extra = {}) {
      if (rec && rec.marks[name] == null) rec.marks[name] = { t: rec.t, ...extra };
    },
    finish() {
      if (!rec) return null;
      const lap = { ...rec, at: Date.now(), v: 2 };
      delete lap.lastSteer;
      try {
        sessionStorage.setItem(KEY, JSON.stringify(lap));
      } catch {
        /* storage off: LAP just shows "no lap set" next time */
      }
      rec = null;
      last = lap;
      return lap;
    },
  };
}

export function loadLap() {
  try {
    const lap = JSON.parse(sessionStorage.getItem(KEY));
    return lap?.v === 2 ? lap : null; // (laps from the old reverse-in drive don't read the same)
  } catch {
    return null;
  }
}

// The numbers, and a driving style from five plain rules (a tiny decision list, shown as such).
export const RULES = [
  'stopped within 50 cm of the marks',
  'over 80 km/h in the pit lane',
  'crossed the line at 74–80 km/h',
  '2 or fewer steering corrections',
  'crossed the line under 60 km/h',
];
export function summarize(lap) {
  if (!lap || !lap.samples?.length) return null;
  const m = lap.marks;
  const limit = LAYOUT.speedLimit;
  const lineKph = m.line ? Math.round(m.line.kph) : null;
  const maxPit = Math.round(m.stopped?.maxPit ?? Math.max(0, ...lap.samples.filter((r) => r[1] >= LAYOUT.entryLine).map((r) => r[2])));
  const offCm = m.stopped ? Math.round(m.stopped.error * 100) : null;
  const stats = {
    time: m.stopped ? m.stopped.t : lap.t,
    lineKph,
    limiterAt: m.limiter ? Math.round(m.limiter.dz) : null, // metres after the line (− = before)
    maxPit,
    corrections: lap.corrections,
    offCm,
  };
  const fired = [
    offCm != null && offCm <= 50 && { label: 'precise', why: `stopped ${offCm} cm from the marks` },
    maxPit > limit + 0.9 && { label: 'pit lane speeder', why: `${maxPit} km/h in an ${limit} zone: that's a fine` },
    lineKph != null && lineKph >= 74 && lineKph <= limit && { label: 'late braker', why: `${lineKph} km/h at the line: right on the limit` },
    stats.corrections <= 2 && { label: 'smooth', why: `${stats.corrections === 0 ? 'no' : stats.corrections} steering correction${stats.corrections === 1 ? '' : 's'} all the way in` },
    lineKph != null && lineKph < 60 && { label: 'careful', why: `crossed the line at ${lineKph} km/h` },
  ];
  const i = fired.findIndex(Boolean);
  const style = i >= 0 ? { ...fired[i], rule: i + 1 } : { label: 'steady', why: 'no rule fired: a tidy, ordinary stop', rule: null };
  return { stats, style, samples: lap.samples };
}
