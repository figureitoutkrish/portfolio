import gsap from 'gsap';
import { sfx } from '../audio/sfx.js';

// The blue gradient wipe, used for the intro and for every page change.
//   direction 'up'    — bottom → top (the intro)
//   direction 'left'  — right → left (going to a page further right in the tab bar)
//   direction 'right' — left → right (going to a page further left)
// The band is 220% of the screen long; at -60% its opaque middle fully covers the screen,
// whichever way it travels. A page change is split at that point:
//   leaving page:  cover  (off-screen → covering)  then navigate
//   arriving page: reveal (covering → off-screen)  — the inline <head> script adds
//                  `html.is-wiping` (+ `wipe-x`) first, so the new page paints already covered.
export const WIPE_HALF = 0.8; // intro: a slower, scene-setting sweep
const PAGE_HALF = 0.55; // page changes: quicker, they happen often
const WIPE_KEY = 'krish:wipe';
const PARALLAX = 64; // px the page drifts with the wipe, so content feels carried by it

const wipeEl = () => document.querySelector('.wipe');
const root = document.documentElement;

// Start / covering / end positions along the wipe's axis.
function track(direction) {
  if (direction === 'up') {
    const h = window.innerHeight;
    return { prop: 'y', from: h, cover: -0.6 * h, to: -2.2 * h };
  }
  const w = window.innerWidth;
  return direction === 'left'
    ? { prop: 'x', from: w, cover: -0.6 * w, to: -2.2 * w }
    : { prop: 'x', from: -2.2 * w, cover: -0.6 * w, to: w };
}

function setAxis(direction) {
  root.classList.toggle('wipe-x', direction !== 'up');
}

export function wipeCover(direction = 'up', duration = WIPE_HALF) {
  const wipe = wipeEl();
  const t = track(direction);
  return gsap.fromTo(
    wipe,
    { x: t.prop === 'x' ? t.from : 0, y: t.prop === 'y' ? t.from : 0, autoAlpha: 1 },
    {
      [t.prop]: t.cover,
      duration,
      ease: 'drawer', // starts fast — it's answering a click — and settles softly into "covered"
      // Don't apply the start state until it plays (it may sit inside a timeline).
      immediateRender: false,
      onStart: () => {
        setAxis(direction);
        window.dispatchEvent(new CustomEvent('wipe:cover'));
      },
    }
  );
}

export function wipeReveal(direction = 'up', duration = WIPE_HALF) {
  const wipe = wipeEl();
  const t = track(direction);
  return gsap.fromTo(
    wipe,
    { x: t.prop === 'x' ? t.cover : 0, y: t.prop === 'y' ? t.cover : 0, autoAlpha: 1 },
    {
      [t.prop]: t.to,
      duration,
      ease: 'ui-in-out', // already on screen: accelerate away, decelerate out
      immediateRender: false,
      onStart: () => setAxis(direction),
      onComplete: () => {
        gsap.set(wipe, { autoAlpha: 0 });
        root.classList.remove('is-wiping', 'wipe-x');
        window.dispatchEvent(new CustomEvent('wipe:revealed'));
      },
    }
  );
}

// ---------- page changes ----------

// The order pages sit in the tab bar, which decides the wipe's direction.
const PAGE_ORDER = ['/data/', '/', '/creative/'];
const normalise = (path) => {
  const p = path.replace(/index\.html$/, '');
  return p.endsWith('/') ? p : `${p}/`;
};
const pageIndex = (path) => PAGE_ORDER.indexOf(normalise(path));

function directionTo(url) {
  const from = pageIndex(window.location.pathname);
  const to = pageIndex(url);
  if (from < 0 || to < 0) return 'left';
  return to > from ? 'left' : 'right';
}

// How this page was arrived at: 'left' | 'right' | null (set by the inline <head> script).
export function arrivalDirection() {
  if (!root.classList.contains('is-wiping')) return null;
  return root.dataset.wipe === 'right' ? 'right' : 'left';
}
export const arrivedViaWipe = () => arrivalDirection() !== null;

// Uncover a page reached through a wipe; the page content drifts in with it.
export function revealArrival() {
  const direction = arrivalDirection();
  if (!direction) return null;
  const main = document.querySelector('main');
  gsap.fromTo(
    main,
    { x: direction === 'left' ? PARALLAX : -PARALLAX },
    { x: 0, duration: PAGE_HALF + 0.35, ease: 'ui-out', clearProps: 'transform' }
  );
  return wipeReveal(direction, PAGE_HALF);
}

let navigating = false;

export function navigate(url, { reducedMotion, lenis } = {}) {
  if (navigating) return;
  navigating = true;
  if (reducedMotion) {
    window.dispatchEvent(new CustomEvent('page:leave'));
    window.location.href = url;
    return;
  }
  const direction = directionTo(url);
  window.dispatchEvent(new CustomEvent('page:leave')); // the record player fades out and saves its place
  sfx('whoosh');
  try {
    sessionStorage.setItem(WIPE_KEY, direction);
  } catch {
    /* storage unavailable: the next page just appears without the reveal half */
  }
  prefetch(url);
  lenis?.stop();
  // The page drifts the way the wipe travels, as if pushed out by it.
  gsap.to('main', { x: direction === 'left' ? -PARALLAX : PARALLAX, duration: PAGE_HALF, ease: 'drawer' });
  wipeCover(direction, PAGE_HALF).eventCallback('onComplete', () => {
    window.location.href = url;
  });
}

function prefetch(url) {
  if (document.head.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.append(link);
}

// Same-origin page links that should go through the wipe.
function pageLink(e) {
  const a = e.target.closest?.('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return { a, url };
}

const samePage = (url) => normalise(url.pathname) === normalise(window.location.pathname);

export function initPageTransitions({ reducedMotion, lenis }) {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = pageLink(e);
    if (!link) return;
    e.preventDefault();
    if (samePage(link.url)) {
      // Like tapping the active tab: go back to the top instead of reloading.
      if (lenis) lenis.scrollTo(0, { force: true }); // force: also works while the journey holds the page
      else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      return;
    }
    navigate(link.url.pathname, { reducedMotion, lenis });
  };
  // Start fetching the next page as soon as intent shows, so it's ready under the wipe.
  const onIntent = (e) => {
    const link = pageLink(e);
    if (link && !samePage(link.url)) prefetch(link.url.pathname);
  };

  // Back/forward cache: a restored page would still be frozen mid-wipe — uncover it.
  const onPageShow = (e) => {
    if (!e.persisted) return;
    navigating = false;
    lenis?.start();
    gsap.set('main', { clearProps: 'transform' });
    if (reducedMotion) {
      gsap.set(wipeEl(), { autoAlpha: 0 });
      root.classList.remove('is-wiping', 'wipe-x');
    } else {
      wipeReveal(root.classList.contains('wipe-x') ? 'left' : 'up', PAGE_HALF);
    }
  };

  document.addEventListener('click', onClick);
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('pointerdown', onIntent, { passive: true });
  window.addEventListener('pageshow', onPageShow);
}
