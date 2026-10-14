import { LAYOUT } from './layout.js';

// The car, as numbers: a guided kinematic model, not a physics sim. Pure (no DOM, no three.js), so
// it runs headless in Node for checks.
//
//   lane      drive down the pit lane: throttle, brake, a little steering inside a soft corridor.
//             Near our garage the top speed eases down so anyone can stop in the zone past it.
//   reverse   stopped in the zone + hold brake/back = R. The car then follows a fixed curve back
//             into the box; back/forward only choose the direction and speed along it (the steering
//             is done for you, and the wheel shows it).
//   parked    stopped on the marks. Nothing moves until reset.
//
// step(dt, input) with input = { throttle 0…1, brake 0…1, back 0…1, steer −1…1 }
// state: x, z, heading (rad, 0 = +z), speed (m/s, + forward), kph, gear ('N','1'…'R'),
//        rpm, steer (wheel position −1…1), mode, distanceToBox, events (this step's: 'shift',
//        'reverse', 'forward', 'parked', 'limiter', 'bump'), message (for the wheel display)
const KPH = 3.6;
const ACCEL = 6.5; // m/s² at low speed
const BRAKE = 13;
const COAST = 0.9; // rolling + aero drag at pit speed, m/s²
const REVERSE_MAX = 2.6; // m/s ≈ 9 km/h
const GEARS = [0, 22, 38, 54, 68, 999]; // km/h at which each gear tops out (1st…5th)
const IDLE = 4000;

export function createVehicle(layout = LAYOUT) {
  const s = {
    mode: 'lane',
    x: 0,
    z: layout.startZ,
    heading: 0,
    speed: 0,
    kph: 0,
    gear: 'N',
    rpm: IDLE,
    steer: 0,
    throttle: 0,
    onLimit: false,
    distanceToBox: Infinity,
    message: '',
    events: [],
  };
  let path = null; // the reverse curve, once built
  let along = 0; // metres along it
  let backHeld = 0; // seconds the back key has been held while stopped
  let parkTimer = 0;
  let lastGear = 'N';
  const box = layout.box;
  const ours = layout.ours;

  function reset({ parked = false } = {}) {
    Object.assign(s, { mode: 'lane', x: 0, z: layout.startZ, heading: 0, speed: 0, gear: 'N', rpm: IDLE, steer: 0, message: '' });
    path = null;
    along = 0;
    backHeld = 0;
    lastGear = 'N';
    if (parked) {
      Object.assign(s, { mode: 'parked', x: box.x, z: box.z, heading: box.heading });
      s.distanceToBox = 0;
    }
  }

  function step(dt, input = {}) {
    dt = Math.min(dt, 1 / 20);
    s.events = [];
    const throttle = clamp01(input.throttle);
    const brake = clamp01(input.brake);
    const back = clamp01(input.back);
    const steerIn = Math.max(-1, Math.min(1, input.steer || 0));
    s.throttle = throttle;

    if (s.mode === 'lane') lane(dt, throttle, brake, back, steerIn);
    else if (s.mode === 'reverse') reverse(dt, throttle, brake, back);
    else {
      s.speed = 0;
      s.steer += (0 - s.steer) * Math.min(1, dt * 3);
    }

    // gear and revs
    s.kph = Math.abs(s.speed) * KPH;
    let gear;
    if (s.mode === 'reverse') gear = 'R';
    else if (s.mode === 'parked' || (s.kph < 0.5 && throttle === 0)) gear = 'N';
    else gear = String(Math.max(1, GEARS.findIndex((top) => s.kph < top)));
    if (gear !== lastGear) {
      if (/\d/.test(gear) && /\d/.test(lastGear)) s.events.push('shift');
      lastGear = gear;
    }
    s.gear = gear;
    let rpm = IDLE;
    if (/\d/.test(gear)) {
      const g = Number(gear);
      const lo = GEARS[g - 1];
      const hi = Math.min(GEARS[g], layout.speedLimit + 2);
      rpm = 6200 + ((s.kph - lo) / Math.max(1, hi - lo)) * 5300 + throttle * 600;
    } else if (gear === 'R') rpm = IDLE + (Math.abs(s.speed) / REVERSE_MAX) * 3500 + throttle * 300;
    else rpm = IDLE + throttle * 7000; // blipping in neutral
    s.rpm += (rpm - s.rpm) * Math.min(1, dt * 10);
    return s;
  }

  // ---------- lane ----------
  function lane(dt, throttle, brake, back, steerIn) {
    const zRel = s.z - ours;
    const [zoneFrom, zoneTo] = layout.reverseZone;
    // top speed: the limiter, eased down approaching our garage and stopping before the exit
    let vmax = layout.speedLimit / KPH;
    if (zRel > -layout.approach) vmax = Math.min(vmax, lerp(layout.speedLimit, 14, smooth((zRel + layout.approach) / (layout.approach + zoneFrom))) / KPH);
    if (zRel > zoneFrom) vmax = Math.min(vmax, lerp(14, 5, smooth((zRel - zoneFrom) / (layout.laneEnd - 3 - zoneFrom))) / KPH);

    const braking = Math.max(brake, s.speed > 0.15 ? back : 0);
    const a = throttle * ACCEL * Math.max(0.2, 1 - (s.speed / (vmax + 0.01)) ** 3) - COAST * Math.sign(s.speed) - braking * BRAKE;
    s.speed = Math.max(0, s.speed + a * dt);
    const onLimit = s.speed >= vmax - 0.05 && throttle > 0;
    if (onLimit && !s.onLimit) s.events.push('limiter'); // once, as you hit it
    s.onLimit = onLimit;
    if (s.speed > vmax) s.speed += (vmax - s.speed) * Math.min(1, dt * 4); // the limiter holds you, gently
    s.z += s.speed * dt;
    if (s.z > ours + layout.laneEnd) {
      s.z = ours + layout.laneEnd;
      if (s.speed > 0.5) s.events.push('bump');
      s.speed = 0;
    }

    // steering: drift across the lane, with soft walls at the corridor's edge
    s.steer += (steerIn - s.steer) * Math.min(1, dt * 6);
    const lat = s.steer * Math.min(1, s.speed / 6) * 2.2; // m/s sideways
    s.x -= lat * dt; // steering right (+) moves toward −x (the driver's right)
    const edge = layout.laneHalf;
    if (Math.abs(s.x) > edge) s.x = Math.sign(s.x) * (edge + (Math.abs(s.x) - edge) * 0.6);
    s.heading = -s.steer * 0.09 * Math.min(1, s.speed / 6);

    s.distanceToBox = Math.hypot(s.x - box.x, s.z - box.z);
    const inZone = zRel >= zoneFrom && zRel <= layout.laneEnd + 0.01;
    if (zRel < -layout.approach) s.message = '';
    else if (zRel < zoneFrom) s.message = 'BOX BOX';
    else s.message = s.speed > 0.2 ? 'STOP' : 'HOLD S: REVERSE';

    // reverse: stopped in the zone and holding back for a moment
    if (s.speed < 0.15 && back > 0 && inZone) {
      backHeld += dt;
      if (backHeld > 0.25) {
        buildPath();
        s.mode = 'reverse';
        s.speed = 0;
        s.events.push('reverse');
      }
    } else if (back === 0) backHeld = 0;
  }

  // ---------- reverse into the box ----------
  function buildPath() {
    // cubic Bézier from where the car stopped, back and round into the box, arriving nose-out
    const p0 = [s.x, s.z];
    const p3 = [box.x, box.z];
    const p1 = [s.x, s.z - Math.max(3, (s.z - box.z) * 0.55)];
    const p2 = [box.x + 5.5, box.z];
    const n = 120;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(bezier(p0, p1, p2, p3, i / n));
    const lens = [0];
    for (let i = 1; i <= n; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    path = { pts, lens, length: lens[n] };
    along = 0;
  }
  function pointAt(d) {
    const { pts, lens } = path;
    d = Math.max(0, Math.min(path.length, d));
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const t = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    const a = pts[i - 1];
    const b = pts[i];
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: b[0] - a[0], dz: b[1] - a[1] };
  }
  function reverse(dt, throttle, brake, back) {
    // speed here is along the path: + = backward into the box
    const want = back - throttle; // back pushes in, forward pulls out
    // off the pedals the car stops quickly at this crawl (engine braking), so it's easy to place
    const drag = want === 0 ? 3 : COAST;
    let a = want * 3.2 - drag * Math.sign(s.speed) - brake * BRAKE * Math.sign(s.speed);
    if (want === 0 && Math.abs(s.speed) < 0.1) {
      s.speed = 0;
      a = 0;
    }
    // guidance: the last two metres to the marks are taken slowly
    const left = path.length - along;
    const cap = left > 0 ? Math.max(0.5, Math.min(REVERSE_MAX, left * 1.1)) : 0.6;
    s.speed = Math.max(-REVERSE_MAX, Math.min(cap, s.speed + a * dt));
    along += s.speed * dt;
    const end = path.length;
    if (along > end + 0.6) {
      along = end + 0.6;
      if (s.speed > 0.4) s.events.push('bump');
      s.speed = 0;
    }
    if (along < 0) {
      // pulled all the way back out: driving down the lane again
      along = 0;
      s.mode = 'lane';
      s.speed = Math.max(0, -s.speed);
      s.heading = 0;
      s.events.push('forward');
      return;
    }
    const p = pointAt(Math.min(along, end));
    const extra = Math.max(0, along - end); // past the marks: keep going straight back
    s.x = p.x - extra;
    s.z = p.z;
    // the car faces against its direction of travel
    s.heading = Math.atan2(-p.dx, -p.dz);
    // the wheel shows the steering the curve needs (curvature, from the heading change ahead)
    const ahead = pointAt(Math.min(end, along + 1.2));
    const turn = wrap(Math.atan2(-ahead.dx, -ahead.dz) - s.heading);
    s.steer += (Math.max(-1, Math.min(1, -turn * 2.4)) - s.steer) * Math.min(1, dt * 4);

    const toGo = end - along;
    s.distanceToBox = Math.abs(toGo);
    s.message = Math.abs(toGo) < 0.3 ? 'ON THE MARKS' : toGo > 0 ? `${toGo.toFixed(1)} M` : `${(-toGo).toFixed(1)} M LONG`;
    if (Math.abs(toGo) < 0.3 && Math.abs(s.speed) < 0.1) {
      parkTimer += dt;
      if (parkTimer > 0.35) {
        s.mode = 'parked';
        s.speed = 0;
        s.message = 'ENGINE MODE: IDLE';
        s.events.push('parked');
      }
    } else parkTimer = 0;
  }

  return { state: s, step, reset, get path() { return path; } };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v || 0));
const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0], w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1]];
}
