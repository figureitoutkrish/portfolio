import { loadLap, summarize } from '../telemetry.js';

// LAP mode: the drive you just did, read like a real lap. The speed trace (throttle and brake
// underneath), the numbers that describe how you drove, and a call on your style made by five
// plain rules, with the one that fired highlighted. If you skipped the drive: no lap set.
const RULES = ['parked within 8 cm', 'first brake under 10 m before the box', 'throttle on for 85%+ of the lane', '2 or fewer steering corrections', 'top speed under 55 km/h'];

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
      <p class="lap-legend"><span><i style="--c:#00d2be"></i>speed</span><span><i style="--c:#19e35b88"></i>throttle</span><span><i style="--c:#ff3b3088"></i>brake</span><span><i style="--c:#ff3b30"></i>reverse</span></p>
      <div class="lap-stats">
        ${stat(fmt(stats.time, 's'), 'lap time')}
        ${stat(stats.reaction != null ? fmt(stats.reaction, 's') : '–', 'reaction')}
        ${stat(`${stats.top}`, 'top km/h')}
        ${stat(stats.brakeBefore != null ? `${Math.max(0, stats.brakeBefore)} m` : 'none', 'braked before box')}
        ${stat(String(stats.corrections), 'corrections')}
        ${stat(stats.errCm != null ? `${stats.errCm} cm` : '–', 'off the marks')}
      </div>
      <ol class="lap-rules">${RULES.map((r, i) => `<li class="${style.rule === i + 1 ? 'hit' : ''}">${i + 1}. ${r}${style.rule === i + 1 ? '  ← you' : ''}</li>`).join('')}</ol>`;
  },
  hints: () => (summarize(loadLap()) ? '<span><b>↕</b> scroll</span><span><b>ok</b> drive it again</span>' : '<span><b>ok</b> take the wheel</span>'),
  ok: () => ({ action: 'drive' }),
  back: () => null,
  leds() {
    const sum = summarize(loadLap());
    if (!sum || sum.stats.errCm == null) return 0;
    return Math.max(1, Math.round(15 * (1 - Math.min(sum.stats.errCm, 30) / 30))); // fuller = closer to the marks
  },
};

const fmt = (v, unit) => `${v.toFixed(1)}${unit}`;
const stat = (v, label) => `<div><b>${v}</b><span>${label}</span></div>`;

// speed over time, with throttle and brake as bands underneath and the reverse dashed red
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
  const fwd = S.filter((r) => !r[5]);
  const rev = S.filter((r) => r[5]);
  const line = (rows) => rows.map((r) => `${x(r[0])},${y(r[2])}`).join(' ');
  return `<svg class="lap-trace" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="speed over time: up to ${Math.round(vmax)} km/h">
    <line class="grid" x1="0" x2="${W}" y1="${y(80)}" y2="${y(80)}" />
    <line class="grid" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" />
    ${bands(3, 'thr', H - 9)}${bands(4, 'brk', H - 4)}
    <polyline class="speed" points="${line(fwd)}" />
    ${rev.length > 1 ? `<polyline class="rev" points="${line(rev)}" />` : ''}
  </svg>`;
}
