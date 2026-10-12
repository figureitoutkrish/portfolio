import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// The journey (bryangarage.dev-inspired): one pinned stage on the blue background.
//   1. boot   — scrolling types `showcase --timeline`, then fills a 24-cell bar
//               ("loading timeline… 42%") while pixels glow up from below. Scroll back: it un-fills.
//               Stop scrolling mid-load and it drains back to 0 until you scroll again.
//   2. reveal — at 100% the terminal hands over to the timeline.
//   3. travel — scrolling moves sideways through the years; a readout shows where you are.
// Bars open a card (hover on desktop, tap on touch, focus from the keyboard).
// Reduced motion: no pin — the timeline is a normal sideways-scrolling strip.
const CELLS_ON_CLASS = 'is-on';
const AXIS_START = 2018;

export function initJourney({ reducedMotion, lenis }) {
  const root = document.querySelector('.journey');
  if (!root) return () => {};

  const stage = root.querySelector('.journey__stage');
  const canvas = root.querySelector('.journey__pixels');
  const term = root.querySelector('.term');
  const cmdEl = term.querySelector('.term__cmd');
  const cells = [...term.querySelectorAll('.term__cell')];
  const label = term.querySelector('.term__label');
  const tl = root.querySelector('.tl');
  const viewport = root.querySelector('.tl__viewport');
  const track = root.querySelector('.tl__track');
  const yearEl = root.querySelector('.tl__year');
  const items = [...root.querySelectorAll('.tl__item')];
  const bars = items.map((li) => li.querySelector('.tl__bar'));
  const card = root.querySelector('.tl__card');
  const cardArt = card.querySelector('.tl__card-art');
  const cardMono = card.querySelector('.tl__card-mono');
  const cardBody = card.querySelector('.tl__card-body');
  const cmd = cmdEl.dataset.cmd;
  const pixels = createPixelField(canvas);

  // The "now" line follows today's date.
  const today = new Date();
  track.style.setProperty('--now', (today.getFullYear() - AXIS_START + today.getMonth() / 12).toFixed(3));

  const px = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  const gutter = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;

  // ---------- boot ----------
  // The command types with the scroll. The bar fills with the scroll too, but it only holds
  // while you keep going: stop half-way and it drains back to 0; scroll again and it refills
  // to where you are. Once it reaches 100% it stays.
  let shown = { chars: -1, cells: -1, label: '' };
  const loader = { fill: 0, target: 0, mode: 'follow' }; // mode: follow | drain | refill
  let drainTween = null;
  let idleCall = null;
  let refillTo = null;

  function renderFill() {
    const fill = loader.fill;
    const on = Math.round(fill * cells.length);
    const text =
      fill <= 0.001
        ? loader.target > 0 ? 'keep scrolling ↓' : 'scroll to run ↓'
        : fill < 1
          ? `loading timeline… ${Math.round(fill * 100)}%`
          : 'timeline ready ✓';
    if (on !== shown.cells) {
      cells.forEach((c, i) => c.classList.toggle(CELLS_ON_CLASS, i < on));
      shown.cells = on;
    }
    if (text !== shown.label) label.textContent = shown.label = text;
    term.classList.toggle('is-loading', fill > 0);
    pixels.draw(fill);
  }

  function startDrain() {
    // Only mid-load, and only while the terminal is the thing on screen.
    if (loader.target <= 0 || loader.target >= 1 || loader.fill <= 0 || !inBoot()) return;
    refillTo?.tween?.kill();
    loader.mode = 'drain';
    drainTween = gsap.to(loader, { fill: 0, duration: 0.4 + loader.fill * 0.9, ease: 'ui-in-out', onUpdate: renderFill });
  }

  function renderBoot(p) {
    const chars = Math.round(Math.min(1, p / 0.28) * cmd.length);
    if (chars !== shown.chars) cmdEl.textContent = cmd.slice(0, (shown.chars = chars));

    const target = gsap.utils.clamp(0, 1, (p - 0.3) / 0.7);
    const moved = target !== loader.target;
    loader.target = target;
    if (moved && loader.mode === 'drain') {
      // Scrolling again: stop draining and fill back up to the scroll position.
      drainTween?.kill();
      loader.mode = 'refill';
    }
    if (loader.mode === 'refill') {
      if (Math.abs(loader.fill - target) < 0.01 || target <= 0 || target >= 1) {
        refillTo?.tween?.kill();
        loader.mode = 'follow';
      } else {
        refillTo ??= gsap.quickTo(loader, 'fill', { duration: 0.35, ease: 'ui-out', onUpdate: renderFill });
        refillTo(target);
      }
    }
    if (loader.mode === 'follow') {
      loader.fill = target;
      renderFill();
    }

    // Each scroll tick (including the scrub settling) pushes the drain back.
    idleCall?.kill();
    idleCall = target > 0 && target < 1 ? gsap.delayedCall(0.25, startDrain) : null;
  }

  // ---------- year readout ----------
  let lastYear = '';
  function updateYear() {
    const x = -gsap.getProperty(track, 'x') || viewport.scrollLeft || 0;
    const center = x + viewport.clientWidth / 2 - gutter();
    const year = gsap.utils.clamp(AXIS_START, AXIS_START + 10, Math.floor(AXIS_START + center / px('--year-w')));
    if (String(year) !== lastYear) yearEl.textContent = lastYear = String(year);
  }

  // ---------- card ----------
  let activeBar = null;
  let cardTrackX = 0; // where the track was when the card opened
  function showCard(bar) {
    if (activeBar === bar) return;
    activeBar?.classList.remove('is-active');
    activeBar = bar;
    cardTrackX = gsap.getProperty(track, 'x');
    bar.classList.add('is-active');
    const li = bar.closest('.tl__item');
    const details = li.querySelector('.tl__details');
    const org = details.querySelector('.tl__d-org').textContent;
    cardBody.innerHTML = details.innerHTML;
    cardArt.querySelector('img')?.remove();
    if (li.dataset.img) {
      const img = new Image();
      img.src = li.dataset.img;
      img.alt = '';
      cardArt.append(img);
    }
    cardMono.textContent = (li.querySelector('.tl__logo')?.textContent || org[0] || '').trim();

    // Sit above the bar (below it if there's no room), lined up with its visible start.
    const s = stage.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    gsap.set(card, { visibility: 'hidden', opacity: 1 });
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const left = gsap.utils.clamp(16, s.width - cw - 16, Math.max(b.left, s.left) - s.left);
    let top = b.top - s.top - ch - 12;
    const below = top < 16;
    if (below) top = b.bottom - s.top + 12;
    gsap.set(card, { x: left, y: top, transformOrigin: below ? '0% 0%' : '0% 100%' });
    gsap.fromTo(
      card,
      { autoAlpha: 0, scale: reducedMotion ? 1 : 0.96 },
      { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'ui-out', overwrite: true }
    );
  }
  function hideCard() {
    if (!activeBar) return;
    activeBar.classList.remove('is-active');
    activeBar = null;
    gsap.to(card, { autoAlpha: 0, scale: reducedMotion ? 1 : 0.97, duration: 0.12, ease: 'ui-out', overwrite: true });
  }

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let programmatic = false;
  let bringIntoView = () => {}; // set below, per mode
  let lastPointerDown = 0;
  bars.forEach((bar) => {
    // Clicking/tapping focuses the button in some browsers; that's not keyboard navigation.
    bar.addEventListener('pointerdown', () => (lastPointerDown = performance.now()));
    if (finePointer) {
      bar.addEventListener('pointerenter', () => showCard(bar));
      bar.addEventListener('pointerleave', hideCard);
    }
    bar.addEventListener('click', () => (activeBar === bar ? hideCard() : showCard(bar)));
    bar.addEventListener('focus', () => {
      if (performance.now() - lastPointerDown > 600) bringIntoView(bar);
    });
    bar.addEventListener('blur', hideCard);
  });
  const onKey = (e) => e.key === 'Escape' && hideCard();
  document.addEventListener('keydown', onKey);

  // ---------- reduced motion: a plain sideways strip ----------
  if (reducedMotion) {
    renderBoot(1);
    gsap.set(tl, { opacity: 1, pointerEvents: 'auto' });
    viewport.addEventListener('scroll', () => {
      updateYear();
      hideCard();
    }, { passive: true });
    updateYear();
    bringIntoView = (bar) => {
      bar.scrollIntoView({ inline: 'center', block: 'nearest' });
      showCard(bar);
    };
    return () => document.removeEventListener('keydown', onKey);
  }

  // ---------- pinned scroll sequence ----------
  // Durations are in px of scroll, so each phase gets exactly the scroll distance it's given.
  let master = null;
  let geo = null;
  const travelDistance = () => Math.max(0, track.offsetWidth - viewport.clientWidth);
  const inBoot = () => !!master?.scrollTrigger?.isActive && master.time() < geo.bootPx;

  function build() {
    const progress = master?.scrollTrigger?.progress ?? 0;
    master?.scrollTrigger?.kill(true);
    master?.kill();
    gsap.set(track, { x: 0 });

    const vh = window.innerHeight;
    const dist = travelDistance();
    const bootPx = vh * 1.1;
    const revealPx = vh * 0.45;
    const travelPx = Math.max(dist * 1.15, vh * 0.6);
    const holdPx = vh * 0.25;
    const boot = { p: 0 };

    master = gsap.timeline({
      defaults: { ease: 'none' }, // scrubbed: the scroll itself is the easing
      // Runs on every animated frame (including the scrub catching up), unlike scrollTrigger.onUpdate.
      onUpdate: () => {
        // Close the card once the timeline actually moves (not on the scrub's settling ticks).
        if (activeBar && !programmatic && Math.abs(gsap.getProperty(track, 'x') - cardTrackX) > 4) hideCard();
        const interactive = gsap.getProperty(tl, 'opacity') > 0.6;
        if (interactive !== (tl.style.pointerEvents === 'auto')) tl.style.pointerEvents = interactive ? 'auto' : 'none';
      },
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: `+=${bootPx + revealPx + travelPx + holdPx}`,
        pin: true,
        scrub: 0.6,
      },
    });
    master
      .to(boot, { p: 1, duration: bootPx, onUpdate: () => renderBoot(boot.p) })
      .to(term, { autoAlpha: 0, scale: 0.97, duration: revealPx * 0.5 })
      .to(canvas, { opacity: 0.35, duration: revealPx * 0.5 }, '<')
      .fromTo(tl, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: revealPx * 0.6 }, `-=${revealPx * 0.2}`)
      .fromTo(items, { opacity: 0, x: 36 }, { opacity: 1, x: 0, duration: revealPx * 0.5, stagger: revealPx * 0.04 }, '<')
      .to(track, { x: -dist, duration: travelPx, onUpdate: updateYear })
      .to({}, { duration: holdPx }); // rest at the end before the page moves on

    geo = { bootPx, revealPx, travelPx, dist };
    drainTween?.kill();
    loader.mode = 'follow';
    renderBoot(0);
    updateYear();
    if (progress) master.scrollTrigger.scroll(master.scrollTrigger.start + progress * (master.scrollTrigger.end - master.scrollTrigger.start));
  }

  // Keyboard: focusing a bar scrolls the journey so that bar sits mid-screen, then opens its card.
  bringIntoView = (bar) => {
    const st = master.scrollTrigger;
    const li = bar.closest('.tl__item');
    const center = li.offsetLeft + gutter() + li.offsetWidth / 2;
    const tx = gsap.utils.clamp(0, geo.dist, center - viewport.clientWidth / 2);
    const target = st.start + geo.bootPx + geo.revealPx + (geo.dist ? tx / geo.dist : 0) * geo.travelPx;
    programmatic = true;
    const done = () => {
      programmatic = false;
      showCard(bar);
    };
    if (lenis) lenis.scrollTo(target, { duration: 0.8, onComplete: () => setTimeout(done, 650) });
    else {
      window.scrollTo({ top: target });
      setTimeout(done, 700); // let the scrub catch up
    }
  };

  build();
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      pixels.resize();
      build();
      ScrollTrigger.refresh();
    }, 200);
  };
  window.addEventListener('resize', onResize);

  return () => {
    master?.scrollTrigger?.kill();
    master?.kill();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
  };
}

// A dotted pixel field that lights up from the bottom as `p` goes 0 → 1.
function createPixelField(canvas) {
  const ctx = canvas.getContext('2d');
  const GAP = 14;
  let w = 0;
  let h = 0;
  let dots = [];
  let lastP = -1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    for (let y = GAP / 2; y < h; y += GAP) {
      for (let x = GAP / 2; x < w; x += GAP) dots.push({ x, y, r: Math.random(), depth: y / h });
    }
    const p = lastP;
    lastP = -1;
    draw(Math.max(0, p));
  }

  function draw(p) {
    const q = Math.round(p * 100) / 100;
    if (q === lastP) return;
    lastP = q;
    ctx.clearRect(0, 0, w, h);
    // Batch by brightness level to keep fillStyle changes low.
    const levels = [[], [], [], []];
    const faint = [];
    for (const d of dots) {
      const reach = d.depth - (1 - q * 1.15); // > 0 once the rising front has passed this row
      const chance = gsap.utils.clamp(0, 1, reach * 2.4) * (0.25 + 0.65 * d.depth);
      if (d.r < chance) levels[Math.min(3, Math.floor(d.r * 4 + q * 1.5))].push(d);
      else if (d.depth > 0.35) faint.push(d);
    }
    ctx.fillStyle = 'rgba(233, 238, 255, 0.07)';
    faint.forEach((d) => ctx.fillRect(d.x, d.y, 2, 2));
    const alphas = [0.3, 0.5, 0.72, 0.95];
    levels.forEach((group, i) => {
      ctx.fillStyle = `rgba(143, 169, 255, ${alphas[i]})`;
      group.forEach((d) => ctx.fillRect(d.x, d.y, 2, 2));
    });
  }

  resize();
  return { draw, resize };
}
