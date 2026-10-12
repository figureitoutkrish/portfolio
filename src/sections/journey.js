import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// The journey (bryangarage.dev-inspired): one pinned stage on the blue background.
//   1. boot   — modelled on bryangarage.dev's showcase band. `showcase --timeline` types itself
//               once the terminal is in view. When the stage reaches the top, the page holds
//               still and scrolling down charges a 24-cell bar instead ("loading timeline… 42%")
//               while pixels glow up from below. Stop and it drains; scroll up to leave.
//   2. reveal — at 100% the page lets go and glides on: the terminal hands over to the timeline.
//   3. travel — scrolling moves sideways through the years; a readout shows where you are.
// Bars open a card (hover on desktop, tap on touch, focus from the keyboard).
// Reduced motion: no pin and no hold — the timeline is a normal sideways-scrolling strip.
const CELLS_ON_CLASS = 'is-on';
const AXIS_START = 2018;

export function initJourney({ reducedMotion, lenis }) {
  const root = document.querySelector('.journey');
  if (!root) return () => {};

  const stage = root.querySelector('.journey__stage');
  const canvas = root.querySelector('.journey__pixels');
  const term = root.querySelector('.term');
  const cmdEl = term.querySelector('.term__cmd');
  const pendingEl = term.querySelector('.term__pending');
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
  // Like bryangarage.dev: the bar is charged by scroll *input*, not scroll position — the page
  // holds still while you scroll, so the bar is the only thing answering. Wheel / swipe / keys
  // add charge; stop and it drains; at 100% it stays and the page carries on.
  const WHEEL_PX = 2000; // wheel distance for a full bar (Bryan: 1200 — Krish wanted it longer)
  const TOUCH_PX = 800; // swipe distance for a full bar (same ratio as Bryan's 1200 / 480)
  const DRAIN = 1.6; // bar per second once you stop (Bryan's rate)
  const IDLE = 0.2; // s without input before it drains — bridges the gaps between wheel notches
  const IDLE_KEYS = 0.6; // held keys only repeat after ~0.5s
  const fillEase = gsap.parseEase('power2.out'); // the shown fill slows towards 100%
  const boot = { v: 0, loaded: false, gated: false, lastInput: 0, idle: IDLE };
  let shown = { cells: -1, label: '' };

  function renderBoot(t) {
    const p = boot.loaded ? 1 : fillEase(boot.v);
    const filling = p > 0.02;
    const on = Math.round(p * cells.length);
    const text = boot.loaded
      ? 'timeline ready ✓'
      : filling
        ? `loading timeline… ${Math.min(99, Math.round(p * 100))}%`
        : 'scroll to run ↓';
    if (on !== shown.cells) {
      cells.forEach((c, i) => c.classList.toggle(CELLS_ON_CLASS, i < on));
      shown.cells = on;
    }
    if (text !== shown.label) label.textContent = shown.label = text;
    term.classList.toggle('is-loading', filling);
    term.style.setProperty('--boot-p', p.toFixed(3));
    pixels.draw(p, t);
  }

  // One frame loop while there's charge to drain or lit pixels to twinkle on screen.
  let ticking = false;
  let lastTick = 0;
  const stageOnScreen = () => {
    const r = stage.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };
  const termVisible = () => stageOnScreen() && gsap.getProperty(term, 'opacity') > 0.01;
  function tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    if (!boot.loaded && now - boot.lastInput > boot.idle * 1000) boot.v = Math.max(0, boot.v - DRAIN * dt);
    if (!termVisible() || (!boot.loaded && boot.v <= 0)) {
      renderBoot(); // settle on a still frame
      gsap.ticker.remove(tick);
      ticking = false;
      return;
    }
    renderBoot(now);
  }
  function startTick() {
    if (ticking || reducedMotion) return;
    ticking = true;
    lastTick = performance.now();
    gsap.ticker.add(tick);
  }

  // The command types itself once the terminal is in view (55ms a character, like Bryan's).
  // The untyped rest is there but invisible, so the caret moves and nothing reflows.
  let typeTimer = 0;
  let typed = reducedMotion;
  const setTyped = (n) => {
    cmdEl.textContent = cmd.slice(0, n);
    pendingEl.textContent = cmd.slice(n);
  };
  setTyped(reducedMotion ? cmd.length : 0);
  function startTyping() {
    if (typed) return;
    typed = true;
    typeObserver?.disconnect();
    let n = 0;
    typeTimer = setInterval(() => {
      setTyped(++n);
      if (n >= cmd.length) clearInterval(typeTimer);
    }, 55);
  }
  const typeObserver = reducedMotion
    ? null
    : new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && startTyping(), { threshold: 0.4 });
  typeObserver?.observe(term);

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
    boot.loaded = true;
    renderBoot();
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
  const revealEase = gsap.parseEase('ui-in-out');

  function build() {
    const progress = master?.scrollTrigger?.progress ?? 0;
    master?.scrollTrigger?.kill(true);
    master?.kill();
    gsap.set(track, { x: 0 });

    const vh = window.innerHeight;
    const dist = travelDistance();
    const revealPx = vh * 0.45;
    const travelPx = Math.max(dist * 1.15, vh * 0.6);
    const holdPx = vh * 0.25;

    master = gsap.timeline({
      defaults: { ease: 'none' }, // scrubbed: the scroll itself is the easing
      // Runs on every animated frame (including the scrub catching up), unlike scrollTrigger.onUpdate.
      onUpdate: () => {
        // Close the card once the timeline actually moves (not on the scrub's settling ticks).
        if (activeBar && !programmatic && Math.abs(gsap.getProperty(track, 'x') - cardTrackX) > 4) hideCard();
        const interactive = gsap.getProperty(tl, 'opacity') > 0.6;
        if (interactive !== (tl.style.pointerEvents === 'auto')) tl.style.pointerEvents = interactive ? 'auto' : 'none';
        if (boot.loaded && termVisible()) startTick(); // back on the terminal: pixels twinkle again
      },
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: `+=${revealPx + travelPx + holdPx}`,
        pin: true,
        scrub: 0.6,
      },
    });
    master
      .to(term, { autoAlpha: 0, scale: 0.97, duration: revealPx * 0.5 })
      .to(canvas, { opacity: 0.35, duration: revealPx * 0.5 }, '<')
      .fromTo(tl, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: revealPx * 0.6 }, `-=${revealPx * 0.2}`)
      .fromTo(items, { opacity: 0, x: 36 }, { opacity: 1, x: 0, duration: revealPx * 0.5, stagger: revealPx * 0.04 }, '<')
      .to(track, { x: -dist, duration: travelPx, onUpdate: updateYear })
      .to({}, { duration: holdPx }); // rest at the end before the page moves on

    geo = { revealPx, travelPx, dist };
    renderBoot();
    updateYear();
    if (progress) master.scrollTrigger.scroll(master.scrollTrigger.start + progress * (master.scrollTrigger.end - master.scrollTrigger.start));
    if (boot.gated) lenis.scrollTo(master.scrollTrigger.start, { immediate: true, force: true });
  }

  // ---------- the hold ----------
  // Arriving at the terminal (scrolling down, bar not loaded yet), the page stops right at the
  // pin. Lenis is stopped, so wheel and swipe no longer move it but still report their deltas.
  function hold() {
    boot.gated = true;
    startTyping(); // in case the in-view check hasn't fired yet
    lenis.scrollTo(master.scrollTrigger.start, { immediate: true, force: true });
    lenis.stop();
  }
  function release() {
    if (!boot.gated) return;
    boot.gated = false;
    lenis.start();
  }
  function charge(px, per, idle) {
    if (boot.loaded) return;
    boot.v = Math.min(1, boot.v + px / per);
    boot.lastInput = performance.now();
    boot.idle = idle;
    if (boot.v >= 1) load();
    else startTick();
  }
  // 100%: it stays loaded, the page lets go and glides through the hand-off to the timeline.
  function load({ advance = true } = {}) {
    boot.loaded = true;
    boot.v = 1;
    renderBoot();
    startTick();
    release();
    if (advance) {
      gsap.delayedCall(0.35, () =>
        lenis.scrollTo(master.scrollTrigger.start + geo.revealPx, { duration: 1.2, easing: revealEase })
      );
    }
  }

  let prevY = window.scrollY;
  const onScroll = () => {
    const st = master?.scrollTrigger;
    if (!st) return;
    const y = window.scrollY;
    if (boot.gated) {
      // Moved anyway (scrollbar drag, scroll-to-top): back up releases, far down counts as loaded.
      if (y < st.start - 2) release();
      else if (y > st.start + window.innerHeight * 0.3) load({ advance: false });
    } else if (!boot.loaded && y > st.start && y > prevY) {
      // Scrolling down into the pin: hold. A big jump past it (End key, a link) isn't dragged back.
      if (y - st.start < window.innerHeight * 0.75) hold();
      else if (prevY <= st.start) load({ advance: false });
    }
    prevY = window.scrollY;
  };

  const onVirtualScroll = ({ deltaY, event }) => {
    if (!boot.gated || event.type === 'touchend') return;
    if (deltaY < -2) release(); // heading back up: let them leave
    else if (deltaY > 0) charge(deltaY, event.type.includes('touch') ? TOUCH_PX : WHEEL_PX, IDLE);
  };

  // Keys still scroll natively while Lenis is stopped, so the hold handles them itself.
  const KEY_CHARGE = { ArrowDown: 100, PageDown: 500, ' ': 500, End: 500 };
  const onHoldKey = (e) => {
    if (!boot.gated || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home' || (e.key === ' ' && e.shiftKey);
    if (up) release();
    else if (KEY_CHARGE[e.key]) {
      e.preventDefault();
      charge(KEY_CHARGE[e.key], WHEEL_PX, IDLE_KEYS);
    }
  };

  // Keyboard: focusing a bar scrolls the journey so that bar sits mid-screen, then opens its card.
  bringIntoView = (bar) => {
    const st = master.scrollTrigger;
    const li = bar.closest('.tl__item');
    const center = li.offsetLeft + gutter() + li.offsetWidth / 2;
    const tx = gsap.utils.clamp(0, geo.dist, center - viewport.clientWidth / 2);
    const target = st.start + geo.revealPx + (geo.dist ? tx / geo.dist : 0) * geo.travelPx;
    if (!boot.loaded) load({ advance: false }); // tabbing into the timeline skips the loader
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

  // Lenis's scroll event lands in the same frame as the scroll itself (no overshoot shown);
  // the native one also covers scrollbar drags.
  lenis.on('scroll', onScroll);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', onHoldKey);
  lenis.on('virtual-scroll', onVirtualScroll);

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
    release();
    gsap.ticker.remove(tick);
    clearInterval(typeTimer);
    typeObserver?.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('keydown', onHoldKey);
    lenis.off('virtual-scroll', onVirtualScroll);
    lenis.off('scroll', onScroll);
    document.removeEventListener('keydown', onKey);
  };
}

// A dotted pixel field that lights up from the bottom as `p` goes 0 → 1. Given a time `t`, lit
// dots twinkle (each on its own phase, like bryangarage.dev's); without one it draws a still frame.
function createPixelField(canvas) {
  const ctx = canvas.getContext('2d');
  const GAP = 14;
  const ALPHAS = [0.3, 0.5, 0.72, 0.95];
  let w = 0;
  let h = 0;
  let dots = [];
  let lastKey = '';
  let lastP = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    for (let y = GAP / 2; y < h; y += GAP) {
      for (let x = GAP / 2; x < w; x += GAP) dots.push({ x, y, r: Math.random(), depth: y / h, phase: Math.random() * Math.PI * 2 });
    }
    lastKey = '';
    draw(lastP);
  }

  function draw(p, t) {
    const q = Math.round(p * 100) / 100;
    const key = t === undefined ? `${q}` : '';
    if (key && key === lastKey) return; // still frame already on screen
    lastKey = key;
    lastP = p;
    ctx.clearRect(0, 0, w, h);
    // Batch by brightness level to keep fillStyle changes low.
    const levels = [[], [], [], []];
    const faint = [];
    const s = t === undefined ? 0 : t / 1000;
    for (const d of dots) {
      const reach = d.depth - (1 - q * 1.15); // > 0 once the rising front has passed this row
      const chance = gsap.utils.clamp(0, 1, reach * 2.4) * (0.25 + 0.65 * d.depth);
      if (d.r < chance) {
        const twinkle = t === undefined ? 0 : Math.sin(s * 6 + d.phase) * 1.2;
        levels[gsap.utils.clamp(0, 3, Math.floor(d.r * 4 + q * 1.5 + twinkle))].push(d);
      } else if (d.depth > 0.35) faint.push(d);
    }
    ctx.fillStyle = 'rgba(233, 238, 255, 0.07)';
    faint.forEach((d) => ctx.fillRect(d.x, d.y, 2, 2));
    levels.forEach((group, i) => {
      ctx.fillStyle = `rgba(143, 169, 255, ${ALPHAS[i]})`;
      group.forEach((d) => ctx.fillRect(d.x, d.y, 2, 2));
    });
  }

  resize();
  return { draw, resize };
}
