import { LAYOUT } from './layout.js';

// The visitor's drive in, recorded like a real lap: 10 samples a second plus the moments that
// matter (first throttle, first brake into the box, stop, reverse, parked). The wheel's LAP mode
// shows it. Nothing leaves the browser: it lives in sessionStorage for this visit only.
// Pure (no DOM besides storage), so summarize() can be checked in Node.
const KEY = 'krish:lap';
const RATE = 0.1; // seconds between samples

export function createRecorder() {
  let rec = null;
  let since = 0;
  return {
    start() {
      rec = { t: 0, samples: [], marks: {}, corrections: 0, lastSteer: 0 };
      since = RATE;
    },
    // called every frame while driving
    frame(dt, s, input) {
      if (!rec) return;
      rec.t += dt;
      const t = rec.t;
      if (input.throttle > 0 && rec.marks.throttle == null) rec.marks.throttle = t;
      const braking = input.brake > 0 || (input.back > 0 && s.mode === 'lane' && s.speed > 0.2);
      if (braking && s.mode === 'lane' && s.z > LAYOUT.ours - LAYOUT.approach - 30 && rec.marks.brake == null) rec.marks.brake = { t, z: s.z };
      // a correction = the steering changes side with some intent
      const st = input.steer;
      if (Math.abs(st) > 0.3 && Math.sign(st) !== Math.sign(rec.lastSteer)) rec.corrections++;
      if (Math.abs(st) > 0.3) rec.lastSteer = st;
      since += dt;
      if (since >= RATE) {
        since = 0;
        rec.samples.push([+t.toFixed(2), +s.z.toFixed(1), +s.kph.toFixed(1), input.throttle ? 1 : 0, braking ? 1 : 0, s.mode === 'reverse' ? 1 : 0]);
      }
    },
    mark(name, extra = {}) {
      if (rec) rec.marks[name] = { t: rec.t, ...extra };
    },
    finish() {
      if (!rec) return null;
      const lap = { ...rec, at: Date.now() };
      delete lap.lastSteer;
      try {
        sessionStorage.setItem(KEY, JSON.stringify(lap));
      } catch {
        /* storage off: LAP just shows "no lap set" next time */
      }
      rec = null;
      return lap;
    },
  };
}

export function loadLap() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

// The numbers, and a driving style from five plain rules (a tiny decision list, shown as such).
export function summarize(lap) {
  if (!lap || !lap.samples?.length) return null;
  const S = lap.samples;
  const lane = S.filter((r) => !r[5]);
  const top = Math.max(...S.map((r) => r[2]));
  const throttleShare = lane.length ? lane.filter((r) => r[3]).length / lane.length : 0;
  const zoneStart = LAYOUT.ours + LAYOUT.reverseZone[0];
  const brake = lap.marks.brake;
  const brakeBefore = brake ? Math.round(zoneStart - brake.z) : null; // metres before the stop zone
  const parked = lap.marks.parked;
  const errCm = parked ? Math.round((parked.error || 0) * 100) : null;
  const stats = {
    time: parked ? parked.t : lap.t,
    reaction: typeof lap.marks.throttle === 'number' ? lap.marks.throttle : null,
    top: Math.round(top),
    throttleShare,
    brakeBefore,
    corrections: lap.corrections,
    errCm,
    reverseTime: lap.marks.reverse && parked ? parked.t - lap.marks.reverse.t : null,
  };
  // first rule that fits wins; each says why
  const RULES = [
    { id: 'precise', test: () => errCm != null && errCm <= 8, label: 'precise', why: `parked ${errCm} cm from the marks` },
    { id: 'late', test: () => brakeBefore == null || brakeBefore < 10, label: 'late braker', why: brakeBefore == null ? 'never touched the brakes: the limiter stopped you' : `first brake ${Math.max(0, brakeBefore)} m before the box` },
    { id: 'flat', test: () => throttleShare > 0.85, label: 'flat out', why: `throttle on for ${Math.round(throttleShare * 100)}% of the lane` },
    { id: 'smooth', test: () => stats.corrections <= 2, label: 'smooth', why: `${stats.corrections === 0 ? 'no' : stats.corrections} steering correction${stats.corrections === 1 ? '' : 's'} all the way in` },
    { id: 'careful', test: () => top < 55, label: 'careful', why: `top speed ${stats.top} km/h under an 80 limit` },
  ];
  const hit = RULES.find((r) => r.test());
  const style = hit ? { label: hit.label, why: hit.why, rule: RULES.indexOf(hit) + 1 } : { label: 'steady', why: 'no rule fired: a tidy, ordinary lap', rule: null };
  return { stats, style, samples: S };
}
