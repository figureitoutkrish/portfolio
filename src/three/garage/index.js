import * as THREE from 'three';
import { loadCar } from './car.js';
import { createLcd } from './lcd.js';
import { buildWorld, buildEnvironment, LAYOUT } from './pitlane.js';

export { LAYOUT };

// The data page's 3D scene: first person in the car, on the night pit lane. The rest of the page
// talks to it only through the API returned here (no three.js outside src/three/).
//   quality  'high' (bloom, more lights) or 'low' (phones, slow GPUs)
//   onProgress(0…1) while the car and textures load
export async function createGarage(canvas, { quality = 'high', reducedMotion = false, onProgress } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
  const dpr = () => Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.5);
  renderer.setPixelRatio(dpr());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1733); // a floodlit night: deep blue, not black
  scene.fog = new THREE.FogExp2(0x15213f, 0.0055);
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.22; // a hint of reflection, no more

  const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 600);

  // loading progress across the car, its textures and fonts for the canvas textures
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress?.(total ? loaded / total : 1);

  const world = buildWorld({ quality });
  scene.add(world.group);

  const lcd = createLcd();
  const car = await loadCar({ manager, lcdTexture: lcd.texture });
  // the rig is the car's pose in the world; the car model and the camera ride on it
  // the display's real width (before the car is placed anywhere): the page sizes the zoom with it
  const lcdBox = new THREE.Box3().setFromObject(car.lcdMesh);
  const lcdWidth = lcdBox.max.x - lcdBox.min.x;
  const rig = new THREE.Group();
  rig.add(car.group);
  scene.add(rig);
  // light that rides with the car: a soft key from the garages' side, a cool rim from behind
  const key = new THREE.SpotLight(0xfff3e2, 14, 9, 0.75, 0.9, 1.2);
  key.position.set(-1.6, 3.2, 1.6);
  key.target.position.set(0, 0.6, 0.6);
  const rim = new THREE.PointLight(0x9fc2ff, 4, 6, 1.5);
  rim.position.set(0.8, 1.8, -2.2);
  rig.add(key, key.target, rim);
  const head = new THREE.Group(); // the driver's head: shakes and looks around inside the rig
  head.position.copy(car.eye);
  rig.add(head);
  head.add(camera);
  camera.rotation.set(0, Math.PI, 0); // three cameras look down −z; the car faces +z
  const LOOK_DOWN = THREE.MathUtils.degToRad(-13);
  // rear camera (shown while reversing): high on the airbox, looking back and down at the line
  const rearCam = new THREE.PerspectiveCamera(62, 2.8, 0.1, 120);
  rearCam.position.set(0, 1.45, -2.2);
  rearCam.rotation.set(-0.42, 0, 0); // three cameras look down −z: that's backwards here
  rig.add(rearCam);
  head.rotation.x = -LOOK_DOWN; // pitch toward the wheel (rotation is applied in the flipped frame)


  // ---------- state the rest of the page drives ----------
  const pose = { x: 0, z: LAYOUT.startZ, heading: 0 };
  const drive = { speed: 0, rpm: 3800, gear: 'N', steer: 0, limiter: true, message: '', mode: 'P', modeLabel: 'MODE' };
  const look = { yaw: 0, pitch: 0 };
  const tickers = new Set(); // called every frame with dt (s), before the scene is drawn
  let baseFov = 58;
  // zoom: 0 = the driver's eye, 1 = face to face with the wheel, sized so the wheel spans `fit` of
  // the screen's width and sits `offsetY` (share of the height) below the centre. The page lines
  // its HTML wheel up with this before swapping them.
  const view = { zoom: 0, fit: 0.9, offsetY: 0, rear: null }; // rear: {left, top, width, height} or null
  const ZOOM_FOV = 34;

  // shift lights: 5 green, 5 red, 5 blue, filling with rpm (idle ≈ 4k, limiter 12.5k)
  const LED_COLOURS = [...Array(5).fill(0x19e35b), ...Array(5).fill(0xff2a2a), ...Array(5).fill(0x3b6bff)].map((c) => new THREE.Color(c));
  const black = new THREE.Color(0x000000);
  const BLUE = new THREE.Color(0x3b6bff);
  let litLeds = -1;
  function setLeds(rpm, flash) {
    // on the pit limiter the whole strip flashes blue; otherwise it fills with the revs (or, once
    // the wheel is the page, shows whatever the page says: drive.leds)
    const n = drive.leds != null ? drive.leds : flash ? 99 : Math.max(0, Math.min(15, Math.round(((rpm - 6000) / (12000 - 6000)) * 15)));
    if (n === litLeds) return;
    litLeds = n;
    car.leds.forEach((led, i) => {
      const on = flash || i < n;
      led.material.emissive.copy(flash ? BLUE : on ? LED_COLOURS[i] : black);
      led.material.emissiveIntensity = on ? 3 : 0;
    });
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    // portrait screens need a wider vertical view to keep the wheel and the garage in frame
    baseFov = aspect >= 1.4 ? 58 : aspect >= 1 ? 64 : 78;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr());
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let raf = 0;
  let visible = true;
  let running = false;
  const pos = new THREE.Vector3();
  const close = new THREE.Vector3();
  const lerp = (a, b, k) => a + (b - a) * k;
  let held = false; // the page's wheel is up: stop drawing until it isn't
  let last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tickers.forEach((fn) => fn(dt));
    const animating = car.controls.update(dt * 1000); // a button or knob still moving
    const t = clock.getElapsedTime();
    // a touch wider with speed (the lane rushes past a little more); narrow when zoomed on the wheel
    const z = view.zoom * view.zoom * (3 - 2 * view.zoom);
    const fov = lerp(baseFov + (reducedMotion ? 0 : Math.min(1, Math.abs(drive.speed) / 80) * 4), ZOOM_FOV, z);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    rig.position.set(pose.x, 0, pose.z);
    rig.rotation.y = pose.heading;
    car.steer.rotation.z = drive.steer * 1.1; // a little more turn on the wheel than the road angle
    // engine vibration: a fine buzz that grows with rpm, plus a slow breathing sway
    // engine shake: barely there at idle, a fine buzz at speed, nothing once parked
    const moving = Math.min(1, Math.abs(drive.speed) / 30);
    const buzz = reducedMotion || drive.gear === 'N' ? 0 : 0.00008 + moving * 0.00028;
    head.position.set(car.eye.x + Math.sin(t * 61) * buzz, car.eye.y + Math.sin(t * 47 + 1) * buzz, car.eye.z);
    head.rotation.set(-LOOK_DOWN + look.pitch, look.yaw - drive.steer * 0.12, -drive.steer * 0.02);
    if (z > 0) {
      // distance that makes the wheel span `fit` of the width at the zoomed fov
      const vHalf = THREE.MathUtils.degToRad(ZOOM_FOV / 2);
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const d = car.wheelWidth / 2 / (view.fit * Math.tan(hHalf));
      const dy = view.offsetY * 2 * d * Math.tan(vHalf); // move the camera so the wheel sits lower/higher
      close.set(car.steer.position.x, car.steer.position.y + dy, car.wheelFace - d);
      head.position.lerp(close, z);
      head.rotation.set(lerp(head.rotation.x, 0, z), lerp(head.rotation.y, 0, z), lerp(head.rotation.z, 0, z));
    }
    setLeds(drive.rpm, drive.flash);
    lcd.draw(drive);
    pos.set(pose.x, 0, pose.z);
    world.update(pos);
    // the car's own key light is for the dark lane; in the garage it would double up
    const out = world.outsideAt(pose.x);
    key.intensity = 4 + 10 * out;
    rim.intensity = 1 + 3 * out;
    renderer.render(scene, camera);
    // the rear camera, in a strip the page positions (rect in CSS px, from the HUD)
    const r = view.rear;
    if (r) {
      rearCam.aspect = r.width / r.height;
      rearCam.updateProjectionMatrix();
      const H = canvas.clientHeight;
      renderer.setScissorTest(true);
      renderer.setScissor(r.left, H - r.top - r.height, r.width, r.height);
      renderer.setViewport(r.left, H - r.top - r.height, r.width, r.height);
      renderer.render(scene, rearCam);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, canvas.clientWidth, H);
    }
    return animating;
  }
  // while held, a pressed button or a turned knob still needs a few frames to move
  let anim = 0;
  function animate() {
    if (running || anim) return;
    last = performance.now();
    const step = () => {
      anim = frame() ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  }
  // the display's box on screen (CSS px), from the 3D display's corners
  const corner = new THREE.Vector3();
  function screenRect() {
    const m = car.lcdMesh;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    m.updateWorldMatrix(true, false);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const x of [b.min.x, b.max.x]) {
      for (const y of [b.min.y, b.max.y]) {
        corner.set(x, y, (b.min.z + b.max.z) / 2).applyMatrix4(m.matrixWorld).project(camera);
        const px = ((corner.x + 1) / 2) * w;
        const py = ((1 - corner.y) / 2) * h;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    frame();
  }
  function start() {
    if (running || !visible || held || document.hidden) return;
    running = true;
    clock.start();
    loop();
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  // pause when scrolled away or the tab is hidden
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) start();
    else stop();
  });
  io.observe(canvas);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  // make sure the canvas fonts are in before the first sign/display draw
  await document.fonts?.ready;
  frame();
  if (!reducedMotion) start();

  return {
    renderer,
    pose,
    drive,
    look,
    view,
    showPath: (points) => world.showPath(points), // the reverse line on the ground ([x, z] pairs)
    // ---- the wheel as the page ----
    wheelSize: () => ({ width: car.wheelWidth, height: car.wheelHeight, display: lcdWidth }),
    // where the display and each control are on screen (CSS px, relative to the canvas)
    wheelLayout() {
      frame();
      return { screen: screenRect(), controls: car.controls.project(camera, canvas.clientWidth, canvas.clientHeight) };
    },
    pressControl(id) {
      car.controls.press(id);
      animate();
    },
    turnControl(id, deg) {
      car.controls.turn(id, deg);
      animate();
    },
    setLeds(n) {
      drive.leds = n;
      animate();
    },
    hands(on) {
      car.gloves.forEach((g) => (g.visible = on)); // parked: hands off the wheel
    },
    // hold the frame (the HTML wheel covers the scene) or carry on
    hold(on) {
      held = on;
      if (on) stop();
      else {
        last = performance.now();
        start();
      }
    },
    onFrame: (fn) => (tickers.add(fn), () => tickers.delete(fn)),
    render: frame,
    info: () => renderer.info.render,
    debug: { scene, camera, head, car, THREE }, // for tuning in the console (dev only)
    dispose() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      world.dispose();
      car.dispose();
      lcd.dispose();
      envRT.dispose();
      renderer.dispose();
    },
  };
}
