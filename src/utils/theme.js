import { wipeCover, wipeReveal } from './transition.js';

// Light / dark theme.
//   - The inline <head> script picks the theme before first paint: the saved choice, else the
//     device setting. It lives on <html data-theme="light|dark">; every colour is a token.
//   - Press K (or the menu's theme button) to switch. The blue wipe sweeps up, the theme flips
//     while the screen is covered, and the sweep carries on — so nothing changes half-way.
//   - The choice is saved and synced: other pages pick it up, and other open tabs follow live.
const KEY = 'krish:theme';
const root = document.documentElement;
const COLORS = { light: '#f7f7f7', dark: '#0b0c10' };

export const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

let status = null;
function apply(theme) {
  // No colour transitions mid-swap: the new theme should land in one frame.
  root.classList.add('theme-switching');
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
  void root.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
  if (status) status.textContent = `${theme} mode`;
  window.dispatchEvent(new CustomEvent('theme:change', { detail: { theme } }));
}

function save(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable: the switch still works for this page */
  }
}

export function initTheme({ reducedMotion }) {
  // The head script set data-theme; match the browser chrome to it right away.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[currentTheme()]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', currentTheme());

  status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('aria-live', 'polite');
  document.body.append(status);

  let busy = false;
  function toggle() {
    if (busy) return;
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    save(next);
    // No sweep when motion is reduced, or when the wipe is already in use (intro, page change).
    if (reducedMotion || root.classList.contains('is-intro') || root.classList.contains('is-wiping')) {
      apply(next);
      return;
    }
    busy = true;
    wipeCover('up', 0.45).then(() => {
      apply(next);
      return wipeReveal('up', 0.55).then(() => {
        busy = false;
      });
    });
  }

  // K anywhere — except while typing, with modifiers held, or on key repeat.
  document.addEventListener('keydown', (e) => {
    if (e.key?.toLowerCase() !== 'k' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    e.preventDefault();
    toggle();
  });

  // Theme buttons (the menu has one, for touch devices without a K key).
  const syncButtons = () =>
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      const label = b.querySelector('[data-theme-label]');
      if (label) label.textContent = currentTheme() === 'dark' ? 'light mode' : 'dark mode';
      b.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
    });
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-theme-toggle]')) toggle();
  });
  window.addEventListener('theme:change', syncButtons);
  syncButtons();

  // Another tab switched: follow it instantly.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && (e.newValue === 'dark' || e.newValue === 'light') && e.newValue !== currentTheme()) apply(e.newValue);
  });

  // No saved choice yet: follow the device if it changes.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let saved = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* ignore */
    }
    if (!saved) apply(e.matches ? 'dark' : 'light');
  });

  return { toggle };
}
