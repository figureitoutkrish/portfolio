// Hover effects, studied from visuvate.com and rebuilt here (no code copied):
//   roll    a label's letters roll up one by one and the same word rolls in from below
//           (two stacked copies per letter; 0.52s, 18ms stagger). Real text stays for screen
//           readers; the rolling copy is aria-hidden.
//   shine   a thin comet of light runs around a card's border while you hover (two layers going
//           opposite ways; a conic gradient on a 1px masked ring, angle animated via @property)
//   shimmer a dotted texture blooms from the centre of a tile in a soft ring and drifts
// Mouse and trackpad only: touch has no hover, so it gets the plain label. Reduced motion: none.
const ROLL = ['.pill', '.koach__chip:not(.koach__chip--static)', '.menu li a', '.menu__theme > span:first-child', '.content__foot a', '.tele__bar a'];
const SHINE = ['.card', '.crew', '.works__card', '.tt__sleeve-art'];
const SHIMMER = ['.crew', '.works__card'];

export function initHoverFx({ reducedMotion }) {
  if (reducedMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const run = () => {
    document.querySelectorAll(ROLL.join(',')).forEach(roll);
    document.querySelectorAll(SHINE.join(',')).forEach(shine);
    document.querySelectorAll(SHIMMER.join(',')).forEach(shimmer);
  };
  run();
  // some pages render cards after load (the work grid): catch them once they appear
  setTimeout(run, 600);
  window.addEventListener('load', run, { once: true });
}

// Wrap the element's first real text node in a rolling copy.
function roll(el) {
  if (el.dataset.roll === 'on') return;
  const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!node) return;
  el.dataset.roll = 'on';
  const text = node.textContent;
  const lead = text.match(/^\s*/)[0];
  const tail = text.match(/\s*$/)[0];
  const word = text.trim();
  const wrap = document.createElement('span');
  wrap.className = 'roll-host';
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = word;
  const vis = document.createElement('span');
  vis.className = 'roll';
  vis.setAttribute('aria-hidden', 'true');
  vis.innerHTML = [...word].map((c, i) => `<span class="roll__c" style="--i:${i}"><span>${c === ' ' ? '&nbsp;' : esc(c)}</span><span>${c === ' ' ? '&nbsp;' : esc(c)}</span></span>`).join('');
  wrap.append(sr, vis);
  node.replaceWith(document.createTextNode(lead), wrap, document.createTextNode(tail));
}
const esc = (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] || c;

function shine(el) {
  if (el.querySelector(':scope > .shine')) return;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.insertAdjacentHTML('beforeend', '<span class="shine shine--a" aria-hidden="true"></span><span class="shine shine--b" aria-hidden="true"></span>');
}

function shimmer(el) {
  if (el.querySelector(':scope > .shimmer')) return;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.insertAdjacentHTML('afterbegin', '<span class="shimmer" aria-hidden="true"></span>');
}
