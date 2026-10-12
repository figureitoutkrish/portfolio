// A little speedometer in the corner: the needle shows how far down the page you are
// (0 at the top, 200 at the finish line). Mouse devices with room only; purely decorative.
export function initSpeedo() {
  if (!matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches) return () => {};
  const el = document.createElement('div');
  el.className = 'speedo';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <svg viewBox="0 0 80 80" width="80" height="80">
      <circle cx="40" cy="40" r="36" fill="#20221f" stroke="#f5f4ef" stroke-width="3"/>
      ${Array.from({ length: 11 }, (_, i) => {
        const a = (-225 + i * 27) * (Math.PI / 180);
        const r1 = i % 5 === 0 ? 24 : 27;
        return `<line x1="${40 + Math.cos(a) * r1}" y1="${40 + Math.sin(a) * r1}" x2="${40 + Math.cos(a) * 31}" y2="${40 + Math.sin(a) * 31}" stroke="${i > 8 ? '#ff5f57' : '#f5f4ef'}" stroke-width="${i % 5 === 0 ? 2.4 : 1.4}"/>`;
      }).join('')}
      <line class="speedo__needle" x1="40" y1="40" x2="40" y2="13" stroke="#b6ed68" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="40" cy="40" r="4" fill="#b6ed68"/>
    </svg>
    <span class="speedo__val">0</span><span class="speedo__unit">km/h</span>`;
  document.body.append(el);
  const needle = el.querySelector('.speedo__needle');
  const val = el.querySelector('.speedo__val');
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    needle.style.transform = `rotate(${-135 + p * 270}deg)`;
    val.textContent = String(Math.round(p * 200));
  };
  const onScroll = () => (raf ||= requestAnimationFrame(update));
  window.addEventListener('scroll', onScroll, { passive: true });
  update();
  return () => window.removeEventListener('scroll', onScroll);
}
