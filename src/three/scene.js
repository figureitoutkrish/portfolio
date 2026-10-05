import * as THREE from 'three';

export function createScene(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 6;

  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.25 })
  );
  mesh.rotation.set(0.4, 0.6, 0);
  scene.add(mesh);

  const state = { scroll: 0 };
  const clock = new THREE.Clock();
  const render = () => renderer.render(scene, camera);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (reducedMotion) render();
  }
  window.addEventListener('resize', onResize);

  // Reduced motion: draw a single still frame instead of running a loop.
  let rafId;
  function tick() {
    const t = clock.getElapsedTime();
    mesh.rotation.x = 0.4 + t * 0.15 + state.scroll * 0.002;
    mesh.rotation.y = 0.6 + t * 0.2;
    render();
    rafId = requestAnimationFrame(tick);
  }
  if (reducedMotion) render();
  else tick();

  return {
    setScroll(y) { state.scroll = y; },
    dispose() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
    },
  };
}
