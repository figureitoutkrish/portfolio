// ?touchdebug on any page: a small on-screen log of every touch, for phones we can't test on.
// Each line: the event, the pointer type, what the touch landed on (the target), the topmost element
// at that point, and whether something cancelled it (prevented). It never takes touches itself.
export function initTouchDebug() {
  if (!new URLSearchParams(location.search).has('touchdebug')) return;
  const box = document.createElement('pre');
  Object.assign(box.style, {
    position: 'fixed', left: '4px', right: '4px', top: '64px', zIndex: '2147483647', margin: '0', padding: '6px 8px',
    maxHeight: '40vh', overflow: 'hidden', background: 'rgba(0,0,0,0.82)', color: '#7fffd4', font: '11px/1.35 ui-monospace, monospace',
    whiteSpace: 'pre-wrap', pointerEvents: 'none', borderRadius: '6px',
  });
  document.body.append(box);
  const lines = [];
  const name = (el) => {
    if (!el || !el.tagName) return String(el);
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };
  const log = (e) => {
    const t = e.touches?.[0] || e.changedTouches?.[0] || e;
    const x = Math.round(t.clientX ?? 0);
    const y = Math.round(t.clientY ?? 0);
    lines.unshift(`${e.type} ${e.pointerType || ''} @${x},${y} → ${name(e.target)} | top: ${name(document.elementFromPoint(x, y))}${e.defaultPrevented ? ' | PREVENTED' : ''}`);
    lines.length = 12;
    box.textContent = `touch debug · ${innerWidth}×${innerHeight} · dpr ${devicePixelRatio} · ${document.documentElement.className}\n` + lines.filter(Boolean).join('\n');
  };
  // capture: seen before anything else can stop it; then once more after the page's own handlers
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'click']) {
    window.addEventListener(type, log, { capture: true, passive: true });
    window.addEventListener(type, (e) => e.defaultPrevented && log(e), { passive: true });
  }
  log({ type: 'ready', target: document.body, clientX: 0, clientY: 0 });
}
