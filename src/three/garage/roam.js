import * as THREE from 'three';
import { LAYOUT } from '../../garage/layout.js';

// On foot in the garage: first person at standing height. The page (src/garage/roam-ui.js) feeds
// the input; this moves the camera, keeps it out of the props, and glides it to the stations.
//   get out   the hands come off, the steering wheel unclips onto the nose, the camera rises out of
//             the cockpit, over the sidepod and down to standing height beside the car
//   walk      move { forward, strafe } (−1…1) and look (dx, dy in radians); collision against
//             the props' boxes with a body radius, inside the garage and the box in front of it
//   go        walk to a point on the floor (click / tap), sliding round anything in the way
//   focus     glide to face a station's screen (or object) so the page can lay its HTML over it;
//             unfocus glides back to where you were standing
//   get in    the reverse of getting out; the camera hands back to the driver's head
const EYE = 1.68;
const RADIUS = 0.3;
const WALK = 2.1; // m/s
const RUN = 3.8;
const BOUNDS = { x0: LAYOUT.garageFront - LAYOUT.garageDepth + 0.45, x1: LAYOUT.garageFront + 5.4, z0: -7.35, z1: 7.35 };
const MIDDLE = new THREE.Vector3(LAYOUT.box.x - 5.2, EYE, 0); // the open floor behind the car
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // in-out: moving on screen

export function createRoam({ scene, camera, head, car, rig, colliders, parts, reducedMotion }) {
  const walker = { x: 0, z: 0, yaw: 0, pitch: 0 }; // yaw 0 = looking down −z (three's default)
  const input = { forward: 0, strafe: 0, run: false };
  let active = false;
  let anim = null; // a scripted camera move (get out / in, focus)
  let target = null; // click-to-go destination {x, z}
  let stuck = 0;
  let bob = 0;
  let speed = 0;
  let focused = null;
  let before = null; // the walker before a focus
  const onStep = new Set();

  // where you stand when you get out: beside the car on the gantry side, turned toward the garage
  const car0 = LAYOUT.box;
  const OUT = { x: car0.x + 0.4, z: car0.z + 2.15, yaw: Math.atan2(1, 0.45), pitch: -0.08 }; // facing into the garage: the car, the TV

  // ---------- stations: what's focusable, and how to frame it ----------
  let dock = 'right'; // where the page docks a station's panel: 'right' or 'bottom' (phones)
  const normalOf = (o) => new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); // a plane faces +z
  // frame a plane mesh: stand on its normal, far enough that it fills `fill` of the screen's width
  function frameFor(mesh, { fill = 0.72, w, h, lift = 0 } = {}) {
    mesh.updateWorldMatrix(true, false);
    const p = mesh.geometry.parameters;
    const sw = w ?? p.width;
    const sh = h ?? p.height;
    const c = mesh.getWorldPosition(new THREE.Vector3());
    const n = normalOf(mesh);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = camera.aspect;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dW = sw / 2 / (Math.tan(hfov / 2) * fill);
    const dH = sh / 2 / (Math.tan(vfov / 2) * 0.56);
    const d = Math.max(dW, dH, 0.55);
    const eye = c.clone().addScaledVector(n, d);
    eye.y += lift;
    // aim a little below the screen so it sits above the middle, clear of the strip at the bottom
    const look = c.clone();
    look.y -= d * Math.tan(vfov / 2) * (dock === 'bottom' ? 0.5 : 0.16); // (phones: the sheet covers the bottom)
    return { eye, look };
  }
  // an object (not a screen): stand in front of it at a set distance, looking slightly down at it.
  // Its panel is docked beside it (right on wide screens, a sheet at the bottom on phones), so aim
  // past the object to keep it in the open part of the view.
  function frameObject(obj, { dist = 1.4, from, height = 1.55, at } = {}) {
    const c = at || new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    const dir = (from || new THREE.Vector3(1, 0, 0)).clone().setY(0).normalize();
    const eye = c.clone().addScaledVector(dir, dist);
    eye.y = height;
    return { eye, look: aside(eye, c) };
  }
  function aside(eye, c) {
    const look = c.clone();
    const fwd = c.clone().sub(eye).setY(0).normalize();
    const rightV = new THREE.Vector3(-fwd.z, 0, fwd.x); // the camera's right
    const d = eye.distanceTo(c);
    if (dock === 'right') look.addScaledVector(rightV, d * 0.42);
    else look.y -= d * 0.32;
    return look;
  }
  const STATIONS = {
    gantry: { label: 'pit wall', size: parts.gantryScreens.length, frame: (i = 0) => frameFor(parts.gantryScreens[i], { fill: 0.78 }), mesh: (i = 0) => parts.gantryScreens[i] },
    stand: { label: 'engineers', frame: () => frameFor(parts.standScreen, { fill: 0.7 }), mesh: () => parts.standScreen },
    tv: { label: 'timing tv', frame: () => frameFor(parts.tv, { fill: 0.8 }), mesh: () => parts.tv },
    github: { label: 'commits', frame: () => frameFor(parts.githubScreen, { fill: 0.74 }), mesh: () => parts.githubScreen },
    car: { label: 'the car', frame: () => frameObject(car.group, { dist: 3.6, from: new THREE.Vector3(0.6, 0, 1), height: 1.9 }) },
    printer: { label: 'printer', frame: () => frameObject(parts.printer, { dist: 1.45, from: new THREE.Vector3(0.25, 0, -1), height: 1.6 }) },
    board: { label: 'pit board', frame: () => { const f = frameFor(parts.boardFace, { fill: 0.4, lift: -0.4 }); return { eye: f.eye, look: aside(f.eye, parts.boardFace.getWorldPosition(new THREE.Vector3())) }; } },
    headset: { label: 'team radio', frame: () => frameObject(parts.headset, { dist: 1.05, from: new THREE.Vector3(0.15, 0, 1), height: 1.75 }) },
    fridge: { label: 'fridge', frame: () => frameObject(parts.fridge, { dist: 1.5, from: new THREE.Vector3(1, 0, -0.3), height: 1.6 }) },
  };

  // ---------- picking: what's under the pointer ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pickables = [];
  const tag = (obj, id, index) => obj.traverse((o) => o.isMesh && ((o.userData.station = id), (o.userData.index = index), pickables.push(o)));
  parts.gantryScreens.forEach((m, i) => tag(m, 'gantry', i));
  tag(parts.standScreen, 'stand');
  tag(parts.headset, 'headset');
  tag(parts.tv, 'tv');
  tag(parts.githubScreen, 'github');
  tag(parts.printer, 'printer');
  tag(parts.board, 'board');
  tag(parts.fridge, 'fridge');
  tag(parts.radio, 'radio');
  tag(car.group, 'car');
  function pick(x, y, width, height) {
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    ray.far = 14;
    const hit = ray.intersectObjects(pickables, false)[0];
    const p = new THREE.Vector3();
    const onFloor = ray.ray.intersectPlane(floor, p);
    if (hit && (!onFloor || hit.distance <= ray.ray.origin.distanceTo(p) + 0.01)) return { station: hit.object.userData.station, index: hit.object.userData.index ?? 0 };
    if (onFloor && ray.ray.origin.distanceTo(p) < 16) return { point: { x: p.x, z: p.z } };
    return null;
  }

  // ---------- collision ----------
  const boxes = [
    ...colliders,
    // the tyre stacks at the front corners, the pillars at the opening
    [LAYOUT.garageFront - 3.6, LAYOUT.garageFront - 1.0, 5.15, 6.1],
    [LAYOUT.garageFront - 2.7, LAYOUT.garageFront - 1.0, -6.1, -5.15],
  ];
  const blocked = (x, z) => {
    if (x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1) return true;
    for (const [x0, x1, z0, z1] of boxes) {
      const cx = Math.max(x0, Math.min(x, x1));
      const cz = Math.max(z0, Math.min(z, z1));
      if ((x - cx) ** 2 + (z - cz) ** 2 < RADIUS * RADIUS) return true;
    }
    return false;
  };
  // move with sliding: try both axes, then each alone
  function moveBy(dx, dz) {
    const { x, z } = walker;
    if (!blocked(x + dx, z + dz)) return ((walker.x += dx), (walker.z += dz), true);
    if (!blocked(x + dx, z)) return ((walker.x += dx), false);
    if (!blocked(x, z + dz)) return ((walker.z += dz), false);
    return false;
  }

  // ---------- camera ----------
  const q = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const lookQuat = (from, to) => {
    const m = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  };
  const walkerQuat = (w) => new THREE.Quaternion().setFromEuler(new THREE.Euler(w.pitch, w.yaw, 0, 'YXZ'));
  const walkerPos = (w, y = EYE) => new THREE.Vector3(w.x, y, w.z);
  const yawPitchOf = (quat) => {
    euler.setFromQuaternion(quat, 'YXZ');
    return { yaw: euler.y, pitch: euler.x };
  };

  // a scripted move along points (positions) with orientations, over `seconds`
  function play(points, quats, seconds, done) {
    if (reducedMotion) {
      camera.position.copy(points[points.length - 1]);
      camera.quaternion.copy(quats[quats.length - 1]);
      anim = null;
      return done?.();
    }
    const curve = points.length > 2 ? new THREE.CatmullRomCurve3(points, false, 'centripetal') : null;
    anim = { curve, points, quats, t: 0, seconds, done };
  }
  function tickAnim(dt) {
    anim.t = Math.min(1, anim.t + dt / anim.seconds);
    const k = ease(anim.t);
    if (anim.curve) anim.curve.getPoint(k, camera.position);
    else camera.position.lerpVectors(anim.points[0], anim.points[1], k);
    // orientation: across the keyframes, evenly
    const n = anim.quats.length - 1;
    const seg = Math.min(n - 1, Math.floor(k * n));
    const local = k * n - seg;
    camera.quaternion.slerpQuaternions(anim.quats[seg], anim.quats[seg + 1], local);
    onAnim?.(k);
    if (anim.t >= 1) {
      const done = anim.done;
      anim = null;
      onAnim = null;
      done?.();
    }
  }
  let onAnim = null;

  // ---------- the steering wheel: unclipped onto the nose when you get out ----------
  const steer = car.steer;
  const steerHome = { pos: steer.position.clone(), quat: steer.quaternion.clone() };
  const steerNose = { pos: new THREE.Vector3(0, 0.74, 0.95), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.25, 0, 0)) };
  function placeSteer(k) {
    steer.position.lerpVectors(steerHome.pos, steerNose.pos, k);
    steer.quaternion.slerpQuaternions(steerHome.quat, steerNose.quat, k);
  }

  // ---------- enter / leave ----------
  function enter(done) {
    if (active) return;
    active = true;
    // the camera leaves the driver's head for the world, where it is now
    const pos = camera.getWorldPosition(new THREE.Vector3());
    const quat = camera.getWorldQuaternion(new THREE.Quaternion());
    scene.add(camera);
    camera.position.copy(pos);
    camera.quaternion.copy(quat);
    car.gloves.forEach((g) => (g.visible = false));
    // up out of the cockpit, over the sidepod on the gantry side, down beside the car
    const toWorld = (x, y, z) => rig.localToWorld(new THREE.Vector3(x, y, z));
    const up = toWorld(0, 1.55, -0.1);
    const over = toWorld(-1.25, 1.85, -0.25);
    Object.assign(walker, OUT);
    const stand = walkerPos(walker);
    const lookFwd = lookQuat(up, toWorld(0, 1.2, 3));
    const lookDown = lookQuat(over, toWorld(-2.2, 0.4, 0.2));
    play([pos, up, over, stand], [quat, lookFwd, lookDown, walkerQuat(walker)], 2.1, () => {
      done?.();
    });
    onAnim = (k) => {
      placeSteer(Math.min(1, k * 2.2));
      if (k > 0.18) {
        car.driver.visible = false;
        if (car.halo) car.halo.visible = true;
      }
    };
  }
  function leave(done) {
    if (!active) return;
    target = null;
    focused = null;
    const toWorld = (x, y, z) => rig.localToWorld(new THREE.Vector3(x, y, z));
    const eye = head.getWorldPosition(new THREE.Vector3());
    const over = toWorld(-1.25, 1.85, -0.25);
    const up = toWorld(0, 1.55, -0.1);
    const seat = lookQuat(eye, toWorld(0, 0.85, 1.2));
    play([camera.position.clone(), over, up, eye], [camera.quaternion.clone(), lookQuat(over, toWorld(0, 0.9, 0.5)), lookQuat(up, toWorld(0, 0.9, 1)), seat], 1.8, () => {
      active = false;
      // back to the driver's head (the page's zoom puts it on the wheel again)
      head.add(camera);
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, Math.PI, 0);
      car.gloves.forEach((g) => (g.visible = true));
      placeSteer(0);
      done?.();
    });
    onAnim = (k) => {
      placeSteer(Math.max(0, 1 - k * 1.6));
      if (k > 0.75) {
        car.driver.visible = true;
        if (car.halo) car.halo.visible = false;
      }
    };
  }

  // ---------- focus ----------
  function focus(id, index = 0, done) {
    const s = STATIONS[id];
    if (!s || !active) return false;
    target = null;
    if (!focused) before = { ...walker };
    focused = { id, index };
    const f = s.frame(index);
    const from = camera.position.clone();
    const dist = from.distanceTo(f.eye);
    if (dist > 3) {
      // across the garage: swing through the middle, not through the walls and the props
      const mid = from.clone().lerp(f.eye, 0.5).lerp(MIDDLE, 0.6);
      mid.y = EYE;
      play([from, mid, f.eye], [camera.quaternion.clone(), lookQuat(mid, f.look), lookQuat(f.eye, f.look)], focusTime(dist) + 0.2, done);
    } else play([from, f.eye], [camera.quaternion.clone(), lookQuat(f.eye, f.look)], focusTime(dist), done);
    return true;
  }
  const focusTime = (d) => Math.min(1.1, 0.45 + d * 0.12);
  function unfocus(done) {
    if (!focused) return;
    focused = null;
    const w = before || walker;
    Object.assign(walker, w);
    const to = walkerPos(walker);
    play([camera.position.clone(), to], [camera.quaternion.clone(), walkerQuat(walker)], focusTime(camera.position.distanceTo(to)), done);
  }

  // ---------- per frame ----------
  function update(dt) {
    if (!active) return;
    if (anim) return tickAnim(dt);
    if (focused) return;
    // keys move relative to where you look; a click-to-go target steers on its own
    let fx = 0;
    let fz = 0;
    if (input.forward || input.strafe) {
      target = null;
      const sin = Math.sin(walker.yaw);
      const cos = Math.cos(walker.yaw);
      // forward is −z rotated by yaw; strafe is +x rotated
      fx = -sin * input.forward + cos * input.strafe;
      fz = -cos * input.forward - sin * input.strafe;
    } else if (target) {
      const dx = target.x - walker.x;
      const dz = target.z - walker.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) target = null;
      else {
        fx = dx / d;
        fz = dz / d;
        // turn to face where you're going, gently
        const want = Math.atan2(-dx, -dz);
        let dy = want - walker.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        walker.yaw += dy * Math.min(1, dt * 4);
        if (d < 0.6) {
          fx *= d / 0.6;
          fz *= d / 0.6;
        }
      }
    }
    const len = Math.hypot(fx, fz);
    const want = len > 0 ? (input.run ? RUN : WALK) : 0;
    speed += (want - speed) * Math.min(1, dt * 10);
    if (len > 0.001 && speed > 0.01) {
      const step = (speed * dt) / Math.max(1, len);
      let free = moveBy(fx * step, fz * step);
      if (!free && target) {
        // someone (or something) in the way: step round it, trying either side
        for (const a of [0.9, -0.9, 1.5, -1.5]) {
          const c = Math.cos(a);
          const sn = Math.sin(a);
          if (moveBy((fx * c - fz * sn) * step, (fx * sn + fz * c) * step)) {
            free = true;
            break;
          }
        }
      }
      if (target) {
        stuck = free ? 0 : stuck + dt;
        if (stuck > 0.6) target = null; // can't get there: stop rather than grind
      }
      // footsteps: a step every ~0.55 m
      const prevBob = bob;
      bob += speed * dt * 5.6;
      if (Math.floor(prevBob / Math.PI) !== Math.floor(bob / Math.PI)) onStep.forEach((fn) => fn());
    }
    const bobY = reducedMotion ? 0 : Math.sin(bob) * 0.018 * Math.min(1, speed / WALK);
    camera.position.copy(walkerPos(walker, EYE + bobY));
    q.copy(walkerQuat(walker));
    camera.quaternion.copy(q);
  }

  // a station's screen on the page (CSS px), for laying HTML over it
  const corner = new THREE.Vector3();
  function rect(id, index = 0, width, height) {
    const mesh = STATIONS[id]?.mesh?.(index);
    if (!mesh) return null;
    mesh.updateWorldMatrix(true, false);
    const p = mesh.geometry.parameters;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const sx of [-0.5, 0.5]) {
      for (const sy of [-0.5, 0.5]) {
        corner.set(sx * p.width, sy * p.height, 0).applyMatrix4(mesh.matrixWorld).project(camera);
        const px = ((corner.x + 1) / 2) * width;
        const py = ((1 - corner.y) / 2) * height;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }

  return {
    get active() {
      return active;
    },
    get busy() {
      return !!anim;
    },
    get focused() {
      return focused;
    },
    stations: Object.fromEntries(Object.entries(STATIONS).map(([id, s]) => [id, { label: s.label, size: s.size || 1 }])),
    enter,
    leave,
    focus,
    unfocus,
    pick,
    rect,
    // where you're standing (world x, z), or null while you're in the car
    position: () => (active ? { x: walker.x, z: walker.z } : null),
    // where the page docks object panels: 'right' (wide screens) or 'bottom' (phones)
    setDock: (d) => (dock = d),
    move(forward, strafe, run = false) {
      input.forward = forward;
      input.strafe = strafe;
      input.run = run;
    },
    look(dx, dy) {
      if (focused || anim) return;
      walker.yaw -= dx;
      walker.pitch = Math.max(-0.75, Math.min(0.6, walker.pitch - dy));
    },
    go(point) {
      if (focused || anim) return;
      target = { x: point.x, z: point.z };
      stuck = 0;
    },
    // near enough to the cockpit to get back in with E
    nearCar() {
      return Math.hypot(walker.x - car0.x, walker.z - car0.z) < 3.4;
    },
    onStep: (fn) => (onStep.add(fn), () => onStep.delete(fn)),
    update,
    yawPitchOf,
  };
}
