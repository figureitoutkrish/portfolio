import gsap from 'gsap';

// ⌘K / Ctrl+K: jump anywhere (bryangarage.dev's "Jump to"). Every page gets the basics (pages,
// socials, theme, email); a page can add its own commands with registerCommands() (the creative
// page adds projects, games, the chat and sound).
//   - opened from the keyboard it appears instantly (no animation on frequent keyboard actions);
//     from a click it grows in quickly
//   - type to filter, ↑ ↓ to move, Enter to run, Esc to close; focus returns where it was
const extra = [];
let refresh = null;
export function registerCommands(list) {
  extra.push(...list);
  refresh?.();
}

const EMAIL = 'krishviramgamatir@gmail.com';

export function initPalette({ reducedMotion, navigate, toggleTheme }) {
  const base = [
    { group: 'Pages', label: 'Home', hint: 'page', keys: 'home main index start', run: () => go('/') },
    { group: 'Pages', label: 'Data · alter ego 01', hint: 'page', keys: 'data science engineering', run: () => go('/data/') },
    { group: 'Pages', label: 'Creative · alter ego 02', hint: 'page', keys: 'creative design work mac', run: () => go('/creative/') },
    ...(document.documentElement.dataset.themeLock ? [] : [{ group: 'Actions', label: 'Toggle dark mode', hint: 'K', keys: 'theme dark light mode', run: () => toggleTheme?.() }]),
    { group: 'Actions', label: 'Copy email', hint: EMAIL, keys: 'email mail contact copy', run: copyEmail },
    { group: 'Actions', label: 'Email Krish', hint: 'mail app', keys: 'email write contact hire', run: () => (location.href = `mailto:${EMAIL}`) },
    { group: 'Elsewhere', label: 'Koach Studio', hint: 'instagram ↗', keys: 'koach agency studio', run: () => out('https://www.instagram.com/koach.studio/') },
    { group: 'Elsewhere', label: 'Instagram', hint: '↗', keys: 'instagram ig social', run: () => out('https://www.instagram.com/figureitoutwithkrish/') },
    { group: 'Elsewhere', label: 'YouTube', hint: '↗', keys: 'youtube videos vlogs', run: () => out('https://www.youtube.com/@figureitoutwithkrish') },
    { group: 'Elsewhere', label: 'LinkedIn', hint: '↗', keys: 'linkedin cv resume', run: () => out('https://www.linkedin.com/in/krish-viramgama-27951927a/') },
    { group: 'Elsewhere', label: 'Behance', hint: '↗', keys: 'behance portfolio design', run: () => out('https://www.behance.net/theinvrangers') },
  ];
  if (!location.pathname.startsWith('/creative')) {
    base.push(
      { group: 'Creative', label: 'See the work', hint: 'creative', keys: 'work projects thumbnails branding', run: () => go('/creative/#work') },
      { group: 'Creative', label: 'Play on the Mac', hint: 'racer · circle', keys: 'play game racer circle mac', run: () => go('/creative/') }
    );
  }

  function go(url) {
    close(true);
    const here = location.pathname === new URL(url, location.href).pathname;
    if (here && url.includes('#')) location.hash = url.split('#')[1];
    else navigate(url);
  }
  function out(url) {
    close(true);
    window.open(url, '_blank', 'noopener');
  }
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      toast('Email copied');
    } catch {
      toast(EMAIL);
    }
  }

  // ---------- UI ----------
  const root = document.createElement('div');
  root.className = 'palette';
  root.hidden = true;
  root.innerHTML = `
    <div class="palette__scrim" data-close></div>
    <div class="palette__panel" role="dialog" aria-modal="true" aria-label="Jump to">
      <div class="palette__field">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <input class="palette__input" type="text" placeholder="Jump to a page, project or action…" aria-label="Search commands" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palette-list" />
        <kbd>esc</kbd>
      </div>
      <ul class="palette__list" id="palette-list" role="listbox"></ul>
      <p class="palette__empty" hidden>Nothing matches. Try “work”, “koach” or “play”.</p>
    </div>`;
  document.body.append(root);
  // The toast lives outside the palette: it's usually shown right after the palette closes.
  const toastEl = document.createElement('p');
  toastEl.className = 'palette__toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  document.body.append(toastEl);
  const panel = root.querySelector('.palette__panel');
  const input = root.querySelector('.palette__input');
  const list = root.querySelector('.palette__list');
  const empty = root.querySelector('.palette__empty');
  let items = [];
  let active = 0;
  let opener = null;

  const all = () => [...base, ...extra];
  function render() {
    const q = input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    items = all()
      .map((c) => {
        const hay = `${c.label} ${c.keys || ''} ${c.group}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        const score = !q ? 0 : c.label.toLowerCase().startsWith(q) ? 2 : c.label.toLowerCase().includes(q) ? 1 : 0;
        return { c, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.innerHTML = '';
    let group = null;
    items.forEach((c, i) => {
      if (!q && c.group !== group) {
        group = c.group;
        const h = document.createElement('li');
        h.className = 'palette__group';
        h.setAttribute('role', 'presentation');
        h.textContent = group;
        list.append(h);
      }
      const li = document.createElement('li');
      li.className = 'palette__item';
      li.id = `palette-opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.innerHTML = '<span class="palette__label"></span><span class="palette__hint"></span>';
      li.querySelector('.palette__label').textContent = c.label;
      li.querySelector('.palette__hint').textContent = c.hint || '';
      li.addEventListener('pointermove', () => setActive(i, false));
      li.addEventListener('click', () => run(i));
      list.append(li);
    });
    empty.hidden = items.length > 0;
    input.setAttribute('aria-activedescendant', items.length ? `palette-opt-${active}` : '');
  }
  refresh = () => !root.hidden && render();
  function setActive(i, scroll = true) {
    active = (i + items.length) % items.length;
    list.querySelectorAll('.palette__item').forEach((li, j) => li.setAttribute('aria-selected', String(j === active)));
    input.setAttribute('aria-activedescendant', `palette-opt-${active}`);
    if (scroll) list.querySelector(`#palette-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }
  function run(i) {
    const c = items[i];
    if (!c) return;
    if (!c.keepOpen) close(true);
    c.run();
  }

  function open({ animate = false } = {}) {
    if (!root.hidden) return;
    opener = document.activeElement;
    root.hidden = false;
    input.value = '';
    active = 0;
    render();
    input.focus({ preventScroll: true });
    document.documentElement.classList.add('is-palette-open');
    if (animate && !reducedMotion) {
      gsap.fromTo(root.querySelector('.palette__scrim'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, ease: 'ui-out' });
      gsap.fromTo(panel, { autoAlpha: 0, scale: 0.97, y: -6 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.18, ease: 'ui-out' });
    }
  }
  function close(skipFocus = false) {
    if (root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove('is-palette-open');
    if (!skipFocus) opener?.focus?.({ preventScroll: true });
  }
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
  }

  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') e.preventDefault(); // stay in the palette
  });
  root.addEventListener('click', (e) => e.target.closest('[data-close]') && close());

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (root.hidden) open();
      else close();
    }
  });
  // Any [data-palette] button (the menu has one) opens it, animated.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-palette]')) open({ animate: true });
  });

  return { open, close, toast };
}
