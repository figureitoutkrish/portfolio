import gsap from 'gsap';

// The blue gradient wipe, used for the intro and for every page change.
// It travels from just below the screen to just above it; halfway (y = -60% of the viewport)
// its opaque middle fully covers the screen. A page change is split at that point:
//   leaving page:  cover  (below → covering)  then navigate
//   arriving page: reveal (covering → above)  — the inline <head> script adds `html.is-wiping`
//                  first, so the new page paints already covered and there's no flash.
export const WIPE_HALF = 0.8;
const WIPE_KEY = 'krish:wipe';

const below = () => window.innerHeight;
const covering = () => -0.6 * window.innerHeight;
const above = () => -2.2 * window.innerHeight;

const wipeEl = () => document.querySelector('.wipe');

export function wipeCover() {
  const wipe = wipeEl();
  // immediateRender: false — don't apply the start state until it plays (it may sit in a timeline).
  return gsap.fromTo(wipe, { y: below, autoAlpha: 1 }, { y: covering, duration: WIPE_HALF, ease: 'power2.in', immediateRender: false });
}

export function wipeReveal() {
  const wipe = wipeEl();
  return gsap.fromTo(
    wipe,
    { y: covering, autoAlpha: 1 },
    {
      y: above,
      duration: WIPE_HALF,
      ease: 'power2.out',
      immediateRender: false,
      onComplete: () => {
        gsap.set(wipe, { autoAlpha: 0 });
        document.documentElement.classList.remove('is-wiping');
      },
    }
  );
}

// True when this page was reached through a wipe (set by the inline <head> script).
export const arrivedViaWipe = () => document.documentElement.classList.contains('is-wiping');

let navigating = false;

export function navigate(url, { reducedMotion, lenis } = {}) {
  if (navigating) return;
  navigating = true;
  if (reducedMotion) {
    window.location.href = url;
    return;
  }
  try {
    sessionStorage.setItem(WIPE_KEY, '1');
  } catch {
    /* storage unavailable: the next page just appears without the reveal half */
  }
  lenis?.stop();
  wipeCover().eventCallback('onComplete', () => {
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

const samePage = (url) => url.pathname.replace(/index\.html$/, '') === window.location.pathname.replace(/index\.html$/, '');

export function initPageTransitions({ reducedMotion, lenis }) {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = pageLink(e);
    if (!link) return;
    e.preventDefault();
    if (samePage(link.url)) {
      // Like tapping the active tab: go back to the top instead of reloading.
      if (lenis) lenis.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      return;
    }
    navigate(link.url.pathname, { reducedMotion, lenis });
  };
  const onIntent = (e) => {
    const link = pageLink(e);
    if (link && !samePage(link.url)) prefetch(link.url.pathname);
  };

  // Back/forward cache: a restored page would still be frozen mid-wipe — uncover it.
  const onPageShow = (e) => {
    if (!e.persisted) return;
    navigating = false;
    lenis?.start();
    if (reducedMotion) gsap.set(wipeEl(), { autoAlpha: 0 });
    else wipeReveal();
  };

  document.addEventListener('click', onClick);
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('touchstart', onIntent, { passive: true });
  window.addEventListener('pageshow', onPageShow);
}
