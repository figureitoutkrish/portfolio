import { QUICKLAP } from './quicklap-content.js';
import { sfx } from '../audio/sfx.js';
import '../styles/quicklap.css';

// The quick lap: the 60-second version of an alter-ego page, for people short on time (a recruiter,
// a client). A pill in the header ("quick lap · Q") opens one sheet: who, the ask, three things worth
// seeing, the stack or the brands, and the one action that matters (the cv, or koach). Styled as an
// F1 timing sheet on the data page and a Mac window on the creative page. The experience behind it
// is untouched: closing the sheet puts you back where you were.
//   - a real <dialog> (focus is held inside, Esc closes, focus returns to the pill)
//   - Q opens it (not while typing); from the keyboard it appears instantly, from a click it rises
//     in quickly; reduced motion: no animation
export function initQuickLap({ page, reducedMotion }) {
  const c = QUICKLAP[page];
  const end = document.querySelector('.site-header__end');
  if (!c || !end) return null;

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = `ql-pill ql-pill--${page}`;
  pill.setAttribute('aria-haspopup', 'dialog');
  pill.innerHTML = `<span>quick lap</span><kbd>Q</kbd>`;
  end.prepend(pill);

  const ext = (href) => (href.startsWith('http') ? ' target="_blank" rel="noopener"' : '');
  const dlg = document.createElement('dialog');
  dlg.className = `ql ql--${page}`;
  dlg.setAttribute('aria-labelledby', 'ql-title');
  dlg.innerHTML = `<div class="ql__sheet">
      <header class="ql__bar">
        ${page === 'creative' ? '<span class="ql__lights" aria-hidden="true"><i></i><i></i><i></i></span>' : '<span class="ql__mark" aria-hidden="true">KV</span>'}
        <span class="ql__bar-t">the quick lap</span>
        <button class="ql__close" type="button" aria-label="Close the quick lap"><span>esc</span></button>
      </header>
      <div class="ql__body">
        <p class="ql__kind">${c.kind}</p>
        <h2 class="ql__name" id="ql-title">${c.name}</h2>
        <p class="ql__line">${c.line}</p>
        <p class="ql__ask">${c.ask}</p>
        <h3 class="ql__h">${c.rowsTitle}</h3>
        <ol class="ql__rows">${c.rows
          .map(
            (r, i) => `<li class="ql__row"><span class="ql__pos">${i + 1}</span><div class="ql__row-main"><b>${r.title}</b><span class="ql__row-kind">${r.kind}</span><p>${r.what}</p></div>${
              r.links ? `<span class="ql__row-links">${r.links.map(([t, h]) => `<a href="${h}"${ext(h)}>${t} ↗</a>`).join('')}</span>` : ''
            }</li>`
          )
          .join('')}</ol>
        <h3 class="ql__h">${c.chipsTitle}</h3>
        <ul class="ql__chips">${c.chips.map((t) => `<li>${t}</li>`).join('')}</ul>
      </div>
      <footer class="ql__foot">
        <a class="ql__primary" href="${c.primary.href}"${c.primary.download ? ' download' : ''}${c.primary.out ? ext(c.primary.href) : ''}>${c.primary.label}</a>
        <span class="ql__links">${c.secondary.map(([t, h]) => `<a href="${h}"${ext(h)}>${t}</a>`).join('')}</span>
        <button class="ql__long" type="button">${c.longWay} →</button>
      </footer>
    </div>`;
  document.body.append(dlg);

  function open({ instant = false } = {}) {
    if (dlg.open) return;
    dlg.classList.toggle('is-instant', instant || reducedMotion);
    dlg.showModal();
    document.documentElement.classList.add('is-quicklap');
    sfx('tap');
  }
  function close() {
    if (!dlg.open) return;
    dlg.close();
  }
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('is-quicklap');
    pill.focus({ preventScroll: true });
  });
  pill.addEventListener('click', () => open());
  dlg.querySelector('.ql__close').addEventListener('click', close);
  dlg.querySelector('.ql__long').addEventListener('click', close);
  // a click on the backdrop (outside the sheet) closes it
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  // keys pressed in the sheet stay in it: the garage and the desk behind it don't drive or walk
  dlg.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if ((e.key === 'q' || e.key === 'Q') && !e.metaKey && !e.ctrlKey && !e.altKey) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'q' && e.key !== 'Q') return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    dlg.open ? close() : open({ instant: true });
  });
  return { open, close };
}
