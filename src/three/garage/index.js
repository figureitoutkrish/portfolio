import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);
  scene.fog = new THREE.FogExp2(0x070a10, 0.011);
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 600);

  // loading progress across the car, its textures and fonts for the canvas textures
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress?.(total ? loaded / total : 1);

  const world = buildWorld({ quality });
  scene.add(world.group);

  const lcd = createLcd();
  const car = await loadCar({ manager, lcdTexture: lcd.texture });
  // the rig is the car's pose in the world; the car model and the camera ride on it
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
  const LOOK_DOWN = THREE.MathUtils.degToRad(-14);
  head.rotation.x = -LOOK_DOWN; // pitch toward the wheel (rotation is applied in the flipped frame)

  // post: bloom on the lamps and LEDs (desktop only)
  let composer = null;
  if (quality === 'high') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82));
    composer.addPass(new OutputPass());
  }

  // ---------- state the rest of the page drives ----------
  const pose = { x: 0, z: LAYOUT.startZ, heading: 0 };
  const drive = { speed: 0, rpm: 3800, gear: 'N', steer: 0, limiter: true, message: '', mode: 'P', modeLabel: 'MODE' };
  const look = { yaw: 0, pitch: 0 };
  const tickers = new Set(); // called every frame with dt (s), before the scene is drawn
  let baseFov = 58;

  // shift lights: 5 green, 5 red, 5 blue, filling with rpm (idle ≈ 4k, limiter 12.5k)
  const LED_COLOURS = [...Array(5).fill(0x19e35b), ...Array(5).fill(0xff2a2a), ...Array(5).fill(0x3b6bff)].map((c) => new THREE.Color(c));
  const black = new THREE.Color(0x000000);
  const BLUE = new THREE.Color(0x3b6bff);
  let litLeds = -1;
  function setLeds(rpm, flash) {
    // on the pit limiter the whole strip flashes blue; otherwise it fills with the revs
    const n = flash ? 99 : Math.max(0, Math.min(15, Math.round(((rpm - 6000) / (12000 - 6000)) * 15)));
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
    composer?.setSize(w, h);
    composer?.setPixelRatio(dpr());
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
  let last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tickers.forEach((fn) => fn(dt));
    const t = clock.getElapsedTime();
    // a touch wider with speed (the lane rushes past a little more)
    const fov = baseFov + (reducedMotion ? 0 : Math.min(1, Math.abs(drive.speed) / 80) * 4);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    rig.position.set(pose.x, 0, pose.z);
    rig.rotation.y = pose.heading;
    car.steer.rotation.z = drive.steer * 1.1; // a little more turn on the wheel than the road angle
    // engine vibration: a fine buzz that grows with rpm, plus a slow breathing sway
    const buzz = reducedMotion ? 0 : 0.0006 + (drive.rpm / 12000) * 0.0012;
    head.position.set(car.eye.x + Math.sin(t * 61) * buzz, car.eye.y + Math.sin(t * 47 + 1) * buzz + Math.sin(t * 1.3) * 0.002, car.eye.z);
    head.rotation.set(-LOOK_DOWN + look.pitch, look.yaw - drive.steer * 0.12, -drive.steer * 0.02);
    setLeds(drive.rpm, drive.flash);
    lcd.draw(drive);
    pos.set(pose.x, 0, pose.z);
    world.update(pos);
    // the car's own key light is for the dark lane; in the garage it would double up
    const out = world.outsideAt(pose.x);
    key.intensity = 4 + 10 * out;
    rim.intensity = 1 + 3 * out;
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    frame();
  }
  function start() {
    if (running || !visible || document.hidden) return;
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
      composer?.dispose();
      renderer.dispose();
    },
  };
}
