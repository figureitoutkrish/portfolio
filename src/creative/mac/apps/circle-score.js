// Scores a hand-drawn circle around a fixed centre. Shared by the game (src/creative/mac/apps/
// circle.js) and the leaderboard server (api/scores.js), which re-scores the submitted points so
// nobody can just post a 100.
//   points: [[x, y], …] in the game's canvas units; center: [x, y]; size: canvas min dimension.
// Returns { score } (0–100, one decimal) or { error } with a short reason.
export const CIRCLE_MAX_SCORE = 99.6; // above this it's a bot, not a hand

export function scoreCircle(points, center, size) {
  if (!Array.isArray(points) || points.length < 12) return { error: 'Draw a full circle' };
  const [cx, cy] = center;

  // Resample by arc length so a slow, wobbly stretch doesn't outweigh a fast, clean one.
  const pts = resample(points, Math.max(1, size / 120));
  if (pts.length < 12) return { error: 'Draw a bigger circle' };

  const radii = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  if (mean < size * 0.12) return { error: 'Too small' };
  if (Math.min(...radii) < mean * 0.35) return { error: 'Too close to the dot' };

  // It has to actually go around: total swept angle of at least ~340°.
  let swept = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a0 = Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx);
    const a1 = Math.atan2(pts[i][1] - cy, pts[i][0] - cx);
    let d = a1 - a0;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    swept += d;
  }
  if (Math.abs(swept) < Math.PI * 2 * 0.94) return { error: 'Draw a full circle' };

  const deviation = radii.reduce((a, r) => a + Math.abs(r - mean), 0) / radii.length / mean;
  // A gap between start and end costs a little.
  const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) / mean;
  const raw = 100 * (1 - deviation * 3.2) - Math.max(0, gap - 0.25) * 12;
  const score = Math.round(Math.max(0, Math.min(CIRCLE_MAX_SCORE, raw)) * 10) / 10;
  return { score };
}

function resample(points, step) {
  const out = [points[0]];
  let [px, py] = points[0];
  let carry = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i];
    let seg = Math.hypot(x - px, y - py);
    let sx = px;
    let sy = py;
    while (carry + seg >= step) {
      const t = (step - carry) / seg;
      sx += (x - sx) * t;
      sy += (y - sy) * t;
      out.push([sx, sy]);
      seg = Math.hypot(x - sx, y - sy);
      carry = 0;
    }
    carry += seg;
    px = x;
    py = y;
  }
  return out;
}
