import * as THREE from 'three';

export function createScene(canvas) {
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
  scene.add(mesh);

  const state = { scroll: 0 };
  const clock = new THREE.Clock();

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  let rafId;
  function tick() {
    const t = clock.getElapsedTime();
    mesh.rotation.x = t * 0.15 + state.scroll * 0.002;
    mesh.rotation.y = t * 0.2;
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  tick();

  return {
    setScroll(y) { state.scroll = y; },
    dispose() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
