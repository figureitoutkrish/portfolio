import { loadLap, summarize, RULES } from '../telemetry.js';

// LAP mode: the drive you just did, read like a real lap. The speed trace (throttle and brake
// underneath, the stretch on the limiter marked), the numbers that describe how you drove, and a
// call on your style made by five plain rules, with the one that fired highlighted. If you
// skipped the drive: no lap set.

export const lap = {
  id: 'lap',
  size: () => 1,
  count: () => (summarize(loadLap()) ? 'your lap' : 'no lap'),
  render(body) {
    const sum = summarize(loadLap());
    if (!sum) {
      body.innerHTML = `<div class="lap-empty"><b>no lap set</b><span>you skipped the drive in. press ok to take the wheel.</span></div>`;
      return;
    }
    const { stats, style, samples } = sum;
    body.innerHTML = `<div class="lap-verdict"><span>you drove like a</span><b>${style.label}</b><span>${style.why}</span></div>
      ${trace(samples)}
      <p class="lap-legend"><span><i style="--c:#00d2be"></i>speed</span><span><i style="--c:#19e35b88"></i>throttle</span><span><i style="--c:#ff3b3088"></i>brake</span><span><i style="--c:#3b6bff"></i>limiter</span></p>
      <div class="lap-stats">
        ${stat(fmt(stats.time, 's'), 'in to the box')}
        ${stat(stats.lineKph != null ? `${stats.lineKph}` : '–', 'km/h at the line')}
        ${stat(stats.limiterAt != null ? `${stats.limiterAt > 0 ? '+' : ''}${stats.limiterAt} m` : 'never', 'limiter on')}
        ${stat(`${stats.maxPit}`, 'top km/h in the lane')}
        ${stat(String(stats.corrections), 'corrections')}
        ${stat(stats.offCm != null ? (stats.offCm >= 100 ? `${(stats.offCm / 100).toFixed(1)} m` : `${stats.offCm} cm`) : '–', 'off the marks')}
      </div>
      <ol class="lap-rules">${RULES.map((r, i) => `<li class="${style.rule === i + 1 ? 'hit' : ''}">${i + 1}. ${r}${style.rule === i + 1 ? '  ← you' : ''}</li>`).join('')}</ol>`;
  },
  hints: () => (summarize(loadLap()) ? '<span><b>↕</b> scroll</span><span><b>ok</b> drive it again</span>' : '<span><b>ok</b> take the wheel</span>'),
  ok: () => ({ action: 'drive' }),
  back: () => null,
  leds() {
    const sum = summarize(loadLap());
    if (!sum || sum.stats.offCm == null) return 0;
    return Math.max(1, Math.round(15 * (1 - Math.min(sum.stats.offCm, 300) / 300))); // fuller = closer to the marks
  },
};

const fmt = (v, unit) => `${v.toFixed(1)}${unit}`;
const stat = (v, label) => `<div><b>${v}</b><span>${label}</span></div>`;

// speed over time, with throttle and brake as bands underneath and the limiter as a line under them
function trace(S) {
  const W = 300;
  const H = 90;
  const t0 = S[0][0];
  const t1 = S[S.length - 1][0] || 1;
  const vmax = Math.max(80, ...S.map((r) => r[2]));
  const x = (t) => (((t - t0) / Math.max(0.1, t1 - t0)) * W).toFixed(1);
  const y = (v) => (H - 14 - (v / vmax) * (H - 20)).toFixed(1);
  const bands = (col, cls, yy) =>
    S.map((r, i) => (r[col] && S[i + 1] ? `<rect class="${cls}" x="${x(r[0])}" y="${yy}" width="${(x(S[i + 1][0]) - x(r[0]) + 0.3).toFixed(1)}" height="4" />` : '')).join('');
  const line = (rows) => rows.map((r) => `${x(r[0])},${y(r[2])}`).join(' ');
  return `<svg class="lap-trace" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="speed over time: up to ${Math.round(vmax)} km/h">
    <line class="grid" x1="0" x2="${W}" y1="${y(80)}" y2="${y(80)}" />
    <line class="grid" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" />
    ${bands(3, 'thr', H - 9)}${bands(4, 'brk', H - 4)}${bands(5, 'lim', H - 13)}
    <polyline class="speed" points="${line(S)}" />
  </svg>`;
}
