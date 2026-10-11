// A tiny 1D spring, parameterised the way Apple does it:
//   response — how quickly it reaches the target, in seconds (not a duration)
//   damping  — 1 = critically damped (no overshoot), < 1 = bouncier
// Springs are interruptible by nature: set() just moves the target and the motion stays
// continuous, carrying its current velocity. Velocity is in units per second.
export function createSpring({ value = 0, response = 0.35, damping = 1, onUpdate }) {
  let x = value;
  let v = 0;
  let target = value;
  let raf = 0;
  let last = 0;

  const stiffness = (2 * Math.PI / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;

  function step(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30); // clamp long frames (tab switches)
    last = now;
    const substeps = 4;
    const h = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      const a = -stiffness * (x - target) - friction * v;
      v += a * h;
      x += v * h;
    }
    if (Math.abs(v) < 1 && Math.abs(x - target) < 0.1) {
      x = target;
      v = 0;
      raf = 0;
      onUpdate(x, 0);
      return;
    }
    onUpdate(x, v);
    raf = requestAnimationFrame(step);
  }

  return {
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
    // Animate toward `to`, optionally handing off a gesture's release velocity.
    set(to, { velocity } = {}) {
      target = to;
      if (velocity !== undefined) v = velocity;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    },
    // Follow a pointer 1:1 (no animation), remembering velocity for the hand-off.
    track(to, velocity = 0) {
      cancelAnimationFrame(raf);
      raf = 0;
      x = target = to;
      v = velocity;
      onUpdate(x, v);
    },
    jump(to) {
      this.track(to, 0);
    },
  };
}

// Apple's momentum projection: where a flick at `velocity` (px/s) would come to rest.
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Progressive resistance past a boundary instead of a hard stop.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
