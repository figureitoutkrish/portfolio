import * as THREE from 'three';

// The steering wheel's central display, drawn on a canvas. It only redraws when a shown value
// changes, so the texture upload is rare even while driving.
const W = 512;
const H = 288;
const MONO = '"JetBrains Mono Variable", ui-monospace, Menlo, monospace';
const TEAL = '#00d2be';

export function createLcd() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  let last = '';
  function draw(s) {
    const speed = Math.round(Math.abs(s.speed || 0));
    const gear = s.gear ?? 'N';
    const key = [speed, gear, s.limiter, s.mode, s.message, Math.round((s.rpm || 0) / 250), s.delta].join('|');
    if (key === last) return;
    last = key;

    g.fillStyle = '#050607';
    g.fillRect(0, 0, W, H);
    // faint pixel grid, like a real TFT up close
    g.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);

    // top banner: pit limiter / phase message
    const banner = s.message || (s.limiter ? 'PIT LIMITER' : '');
    if (banner) {
      g.fillStyle = s.limiter ? TEAL : '#f5f5f5';
      g.font = `600 30px ${MONO}`;
      g.textAlign = 'center';
      g.fillText(banner, W / 2, 42);
    }

    // three cells: speed · gear · mode
    const box = (x, w) => {
      g.strokeStyle = 'rgba(255,255,255,0.28)';
      g.lineWidth = 2;
      g.strokeRect(x, 62, w, 120);
    };
    box(24, 150);
    box(338, 150);
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.font = `600 62px ${MONO}`;
    g.fillText(String(speed), 99, 140);
    g.font = `500 18px ${MONO}`;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText('KPH', 99, 168);

    g.fillStyle = gear === 'R' ? '#ff4a3d' : '#ffffff';
    g.font = `700 128px ${MONO}`;
    g.fillText(gear, W / 2, 170);

    g.fillStyle = '#ffffff';
    g.font = `600 56px ${MONO}`;
    g.fillText(s.mode || 'P', 413, 136);
    g.font = `500 18px ${MONO}`;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(s.modeLabel || 'MODE', 413, 168);

    // bottom row: tyre/brake temps (static-ish) and the rpm readout
    g.textAlign = 'left';
    g.font = `500 24px ${MONO}`;
    g.fillStyle = '#ffffff';
    g.fillText(`${Math.round(s.rpm || 0).toString().padStart(5, ' ')} RPM`, 28, 236);
    g.textAlign = 'right';
    g.fillText(s.delta || 'BB 56.0%', W - 28, 236);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = `500 18px ${MONO}`;
    g.textAlign = 'left';
    g.fillText('TYRES 77°C  74°C', 28, 268);
    g.textAlign = 'right';
    g.fillText('KV · DATA', W - 28, 268);

    texture.needsUpdate = true;
  }

  draw({ speed: 0, gear: 'N', rpm: 0, limiter: true });
  return { texture, draw, dispose: () => texture.dispose() };
}
