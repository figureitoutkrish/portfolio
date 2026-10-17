import { LAYOUT } from './layout.js';

// The car, as numbers. Pure (no DOM, no three.js), so it runs headless in Node for checks.
//
// Steering is a kinematic bicycle model, the way a car actually turns: the rear axle follows the
// direction the car points, and the front wheels' angle δ sets how fast it rotates,
// yaw rate = v · tan δ / wheelbase. Numbers from the real thing:
//   wheelbase   3.715 m (the W11's, measured off the model; Mercedes ran the longest on the grid)
//   lock        ±18° at the front wheels, ±180° at the steering wheel (about 360° lock to lock, a
//               10:1 ratio), so the wheel in your hands turns ten times the road angle
//   grip        ~2.2 g sideways at pit speeds: ask for more and the car runs wide (understeer)
//   limiter     80 km/h, works in 1st–3rd; F1 gearing, so the pit lane is 1st and 2nd
// A keyboard is on/off, so a press asks for less lock the faster you go (drivers use a few
// degrees at 80 km/h) and the brake builds pressure over a fifth of a second.
//
// Modes:
//   drive     rolling in at 110 km/h: brake under 80 before the pit entry line, switch the limiter
//             on (input.limiter), drive down the lane, steer into the box and stop.
//   service   stopped at the box: jack up, wheel guns (drive.js runs the moment).
//   push      the mechanics push the car back into the garage along a curve (push()).
//   parked    in the garage, nose out. Nothing moves until reset.
//
// step(dt, input) with input = { throttle 0…1, brake 0…1, steer −1…1 (+ = right), limiter: true
// on the frame the limiter button is pressed }
// state: x, z (car origin), heading (rad, 0 = +z, + = turning left), speed (m/s), kph, gear, rpm,
//        steer (−1…1 of full lock), wheel (steering wheel angle, rad), road (front wheel angle,
//        rad), spin (wheel roll, rad), limiter, onLimit, pitLane, speeding, toMarks, offMarks,
//        mode, message (for the wheel's display), events (this step's: 'shift', 'limiter-on',
//        'limiter-off', 'limiter' (hit it), 'line', 'bump', 'stopped', 'parked')
const KPH = 3.6;
const { front: FRONT, rear: REAR } = LAYOUT.axles;
const WHEELBASE = FRONT - REAR;
const LOCK = (18 * Math.PI) / 180;
const RATIO = 10;
const GRIP = 22; // m/s²
const ACCEL = 9; // m/s², traction-limited at these speeds
const ROAD_MAX = 130 / KPH; // the pit entry road
const STEER_RATE = 2.4; // lock fractions per second: centre to full in about 0.4 s
const GEARS = [0, 70, 100, 130, 999]; // km/h at which 1st…4th top out
const IDLE = 4000;
const TYRE_R = 0.33;

export function createVehicle(layout = LAYOUT) {
  const s = {
    mode: 'drive',
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    kph: 0,
    gear: 'N',
    rpm: IDLE,
    steer: 0,
    wheel: 0,
    road: 0,
    spin: 0,
    throttle: 0,
    brake: 0,
    limiter: false,
    onLimit: false,
    pitLane: false,
    speeding: false,
    lineKph: null,
    maxPitKph: 0,
    toMarks: Infinity,
    offMarks: null,
    message: '',
    events: [],
  };
  let rx = 0; // rear axle position (the bicycle model integrates this)
  let rz = 0;
  let still = 0; // seconds stopped near the box
  let lastGear = 'N';
  let push = null; // { pts, lens, length, t, T }
  const fwd = (h) => [Math.sin(h), Math.cos(h)];
  const fromRear = () => {
    const [fx, fz] = fwd(s.heading);
    s.x = rx - fx * REAR;
    s.z = rz - fz * REAR;
  };
  const toRear = () => {
    const [fx, fz] = fwd(s.heading);
    rx = s.x + fx * REAR;
    rz = s.z + fz * REAR;
  };

  function reset({ parked = false } = {}) {
    Object.assign(s, {
      mode: 'drive', x: 3, z: layout.startZ, heading: 0, speed: layout.startKph / KPH, steer: 0, wheel: 0, road: 0, brake: 0,
      limiter: false, onLimit: false, pitLane: false, speeding: false, lineKph: null, maxPitKph: 0, toMarks: Infinity, offMarks: null, message: '',
    });
    push = null;
    still = 0;
    lastGear = 'N';
    if (parked) Object.assign(s, { mode: 'parked', x: layout.box.x, z: layout.box.z, heading: layout.box.heading, speed: 0, offMarks: 0 });
    toRear();
  }
  reset();

  function step(dt, input = {}) {
    dt = Math.min(dt, 1 / 20);
    s.events = [];
    const throttle = clamp01(input.throttle);
    const brake = clamp01(input.brake);
    const steerIn = Math.max(-1, Math.min(1, input.steer || 0));
    s.throttle = throttle;
    if (input.limiter && s.mode === 'drive') {
      s.limiter = !s.limiter;
      s.events.push(s.limiter ? 'limiter-on' : 'limiter-off');
    }

    if (s.mode === 'drive') drive(dt, throttle, brake, steerIn);
    else if (s.mode === 'push') pushStep(dt);
    else {
      s.speed = 0;
      s.steer += (0 - s.steer) * Math.min(1, dt * 3);
    }
    s.road = s.steer * LOCK;
    s.wheel = s.road * RATIO;
    s.spin += (s.speed * dt) / TYRE_R;

    // gear and revs
    s.kph = Math.abs(s.speed) * KPH;
    let gear;
    if (s.mode !== 'drive' || (s.kph < 0.5 && throttle === 0)) gear = 'N';
    else gear = String(Math.max(1, GEARS.findIndex((top) => s.kph < top)));
    if (gear !== lastGear) {
      if (/\d/.test(gear) && /\d/.test(lastGear)) s.events.push('shift'); // up, or a blipped downshift
      lastGear = gear;
    }
    s.gear = gear;
    let rpm = IDLE + throttle * 7000; // neutral: blipping
    if (/\d/.test(gear)) {
      const g = Number(gear);
      const lo = GEARS[g - 1];
      const hi = Math.min(GEARS[g], ROAD_MAX * KPH);
      rpm = 7200 + ((s.kph - lo) / Math.max(1, hi - lo)) * 4600 + throttle * 300;
    }
    s.rpm += (rpm - s.rpm) * Math.min(1, dt * 10);
    s.message = message();
    return s;
  }

  // ---------- driving ----------
  function drive(dt, throttle, brakeIn, steerIn) {
    let v = s.speed;
    // brake pressure builds while it's held (a key is on/off; a foot isn't)
    s.brake = brakeIn ? Math.min(1, s.brake + dt / 0.22) : Math.max(0, s.brake - dt / 0.1);
    const vcap = s.limiter ? layout.speedLimit / KPH : ROAD_MAX;
    const power = v < vcap ? throttle * ACCEL * (1 - (v / vcap) ** 4) : 0; // the limiter cuts the power
    const drag = v > 0 ? 0.5 + 0.0012 * v * v : 0; // rolling, aero and engine braking
    const stop = s.brake * (14 + 0.3 * v); // more grip, more brake, the faster you go
    v = Math.max(0, v + (power - drag - stop) * dt);
    const onLimit = s.limiter && throttle > 0 && v >= vcap - 0.15;
    if (onLimit && !s.onLimit) s.events.push('limiter');
    s.onLimit = onLimit;

    // steering: the faster you go, the less lock a key asks for
    const most = 1 / Math.sqrt(1 + (v / 7) ** 2);
    const target = steerIn * most;
    const d = target - s.steer;
    s.steer += Math.sign(d) * Math.min(Math.abs(d), STEER_RATE * dt);
    let yaw = (v * Math.tan(s.steer * LOCK)) / WHEELBASE;
    const maxYaw = GRIP / Math.max(v, 0.5);
    yaw = Math.max(-maxYaw, Math.min(maxYaw, yaw)); // past the grip, the car runs wide
    s.heading = Math.max(-1.2, Math.min(1.2, s.heading - yaw * dt)); // steering right turns it right
    const [fx, fz] = fwd(s.heading);
    rx += fx * v * dt;
    rz += fz * v * dt;
    fromRear();

    // the pit wall on the left, the garages on the right: glance off them
    const { left, right } = layout.bounds;
    if (s.x > left || s.x < right) {
      s.x = Math.max(right, Math.min(left, s.x));
      if (v > 1.2) s.events.push('bump');
      v *= 0.55;
      s.heading *= 0.4;
      toRear();
    }
    if (s.z > layout.ours + layout.laneEnd) {
      s.z = layout.ours + layout.laneEnd;
      if (v > 0.5) s.events.push('bump');
      v = 0;
      toRear();
    }
    s.speed = v;
    s.kph = v * KPH;

    // the pit entry line: from here the limit applies
    if (!s.pitLane && s.z >= layout.entryLine) {
      s.pitLane = true;
      s.lineKph = s.kph;
      s.events.push('line');
    }
    if (s.pitLane) {
      s.speeding = s.kph > layout.speedLimit + 0.9;
      s.maxPitKph = Math.max(s.maxPitKph, s.kph);
    }

    // the box: how far to the marks, and stopping there
    const box = layout.pitBox;
    s.toMarks = box.z - s.z;
    if (v < 0.05 && s.z > box.z - 12) {
      still += dt;
      if (still > 0.45) {
        s.mode = 'service';
        s.speed = 0;
        s.brake = 0;
        s.offMarks = Math.hypot(s.x - box.x, s.z - box.z);
        s.events.push('stopped');
      }
    } else still = 0;
  }

  // ---------- pushed back into the garage ----------
  // a cubic Bézier from where the car stopped, backwards and round into the garage, ending nose
  // out; the crew walks it there in a few seconds, easing in and out
  function startPush() {
    if (s.mode !== 'service') return;
    const box = layout.box;
    const [fx, fz] = fwd(s.heading);
    const [bx, bz] = fwd(box.heading);
    const span = Math.hypot(s.x - box.x, s.z - box.z);
    const p0 = [s.x, s.z];
    const p1 = [s.x - fx * span * 0.45, s.z - fz * span * 0.45];
    const p2 = [box.x + bx * 4.5, box.z + bz * 4.5];
    const p3 = [box.x, box.z];
    const n = 120;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(bezier(p0, p1, p2, p3, i / n));
    const lens = [0];
    for (let i = 1; i <= n; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const length = lens[n];
    push = { pts, lens, length, t: 0, T: Math.max(3, Math.min(4.5, length / 2.6)) };
    s.mode = 'push';
  }
  function pointAt(d) {
    const { pts, lens } = push;
    d = Math.max(0, Math.min(push.length, d));
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const t = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    const a = pts[i - 1];
    const b = pts[i];
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: b[0] - a[0], dz: b[1] - a[1] };
  }
  function pushStep(dt) {
    push.t = Math.min(push.T, push.t + dt);
    const k = push.t / push.T;
    const e = k * k * (3 - 2 * k);
    const d = e * push.length;
    const p = pointAt(d);
    const before = Math.hypot(p.x - s.x, p.z - s.z);
    s.x = p.x;
    s.z = p.z;
    s.heading = Math.atan2(-p.dx, -p.dz); // moving backwards: the nose points against the travel
    s.speed = -before / Math.max(dt, 1e-3);
    // the driver steers as the crew asks (the curve's curvature, a little ahead); the crew does the
    // real work, so it's a modest turn of the wheel, not full lock
    const ahead = pointAt(Math.min(push.length, d + 1.2));
    const turn = wrap(Math.atan2(-ahead.dx, -ahead.dz) - s.heading);
    s.steer += (Math.max(-0.3, Math.min(0.3, -turn * 2.4)) - s.steer) * Math.min(1, dt * 4);
    toRear();
    if (push.t >= push.T) {
      s.mode = 'parked';
      s.speed = 0;
      s.events.push('parked');
    }
  }

  // ---------- the wheel's display banner ----------
  function message() {
    if (s.mode === 'service') return s.offMarks < 0.3 ? 'ON THE MARKS' : `${s.offMarks.toFixed(1)} M OFF`;
    if (s.mode === 'push') return 'NEUTRAL';
    if (s.mode === 'parked') return 'ENGINE MODE: IDLE';
    if (!s.pitLane) return layout.entryLine - s.z < 60 && s.kph > layout.speedLimit ? 'SLOW: 80' : 'BOX BOX';
    if (!s.limiter) return 'LIMITER OFF';
    if (s.toMarks < 45) return `${Math.max(0, s.toMarks).toFixed(0)} M`;
    return ''; // (the display shows PIT LIMITER)
  }

  return { state: s, step, reset, push: startPush, get path() { return push?.pts ?? null; } };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v || 0));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0], w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1]];
}
