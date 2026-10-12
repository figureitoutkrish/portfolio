import gsap from 'gsap';

// The Mac's physical parts: power, brightness knob, eject, LED, the two floppies and the
// gamepad keys. Talks to the OS (os.js) through its public API.
//   Floppies: drag one into the slot under the screen (or click / Enter it) and it slides in and
//   the game loads. Eject (or Esc, or power) pops it back out and it springs home to the desk.
export function initCabinet({ os, reducedMotion }) {
  const mac = document.querySelector('[data-mac]');
  if (!mac || !os) return () => {};
  const desk = mac.closest('.desk');
  const slot = mac.querySelector('.mac3d__slot');
  const mouth = mac.querySelector('.mac3d__slot-mouth');
  const led = mac.querySelector('.mac3d__led');
  const power = mac.querySelector('.mac3d__power');
  const knob = mac.querySelector('.mac3d__knob');
  const eject = mac.querySelector('.mac3d__eject');
  const disks = [...desk.querySelectorAll('.floppy')];
  const padBtns = [...desk.querySelectorAll('.pad__btn')];
  const cleanups = [];

  const blink = (times = 3) => {
    if (reducedMotion) return;
    gsap.fromTo(led, { opacity: 0.25 }, { opacity: 1, duration: 0.08, repeat: times * 2 - 1, yoyo: true, ease: 'none', clearProps: 'opacity' });
  };

  // ---------- power ----------
  power.addEventListener('click', () => {
    if (os.state.on) {
      if (os.state.disk) ejectDisk(); // like pulling the plug: the game ends
      os.powerOff();
    } else os.powerOn();
  });
  const offPower = os.on((type, on) => {
    if (type !== 'power') return;
    power.setAttribute('aria-pressed', String(on));
    led.classList.toggle('is-off', !on);
  });
  cleanups.push(offPower);

  // ---------- brightness knob (a thumbwheel on the side) ----------
  let bright = 100;
  const setBright = (v) => {
    bright = Math.max(40, Math.min(100, Math.round(v)));
    knob.setAttribute('aria-valuenow', String(bright));
    knob.style.backgroundPosition = `0 ${bright * 0.6}px`; // the ridges roll as it turns
    os.setBrightness(bright / 100);
  };
  knob.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    knob.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const start = bright;
    const move = (ev) => setBright(start + (startY - ev.clientY) * 0.8);
    const up = () => {
      knob.removeEventListener('pointermove', move);
      knob.removeEventListener('pointerup', up);
      knob.removeEventListener('pointercancel', up);
    };
    knob.addEventListener('pointermove', move);
    knob.addEventListener('pointerup', up);
    knob.addEventListener('pointercancel', up);
  });
  knob.addEventListener('keydown', (e) => {
    const step = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 20, PageDown: -20 }[e.key];
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    if (e.key === 'Home') setBright(40);
    else if (e.key === 'End') setBright(100);
    else setBright(bright + step);
  });

  // ---------- floppies ----------
  const home = new Map(); // each disk's resting rotation
  disks.forEach((d) => home.set(d, gsap.getProperty(d, 'rotation')));
  let inside = null; // the disk element currently in the slot
  let busy = false;

  const slotTarget = (disk) => {
    // where the disk's centre must go so it lines up with the slot mouth
    const m = mouth.getBoundingClientRect();
    const r = disk.getBoundingClientRect();
    return { dx: m.left + m.width / 2 - (r.left + r.width / 2), dy: m.top + m.height / 2 - (r.top + r.height / 2), fit: (m.width * 0.92) / disk.offsetWidth };
  };

  function insert(disk) {
    if (busy || !os.state.on) {
      if (!os.state.on) os.alert?.('Turn the Mac on first (the round button).');
      return;
    }
    if (inside === disk) return;
    if (inside) {
      ejectDisk(() => insert(disk));
      return;
    }
    busy = true;
    disk.classList.add('is-moving');
    const curX = gsap.getProperty(disk, 'x');
    const curY = gsap.getProperty(disk, 'y');
    const { dx, dy, fit } = slotTarget(disk);
    const finish = () => {
      disk.classList.remove('is-moving');
      disk.classList.add('is-inside');
      disk.setAttribute('aria-pressed', 'true');
      inside = disk;
      busy = false;
      blink(4);
      os.insertDisk(disk.dataset.disk);
    };
    if (reducedMotion) {
      gsap.set(disk, { autoAlpha: 0 });
      finish();
      return;
    }
    gsap
      .timeline({ onComplete: finish })
      // line up under the slot, flat and slot-width…
      .to(disk, { x: curX + dx, y: curY + dy + disk.offsetHeight * fit * 0.55, rotation: 0, scale: fit, duration: 0.32, ease: 'ui-in-out' })
      // …then slide up into it, swallowed by the mouth
      .to(disk, { y: curY + dy, scaleY: fit * 0.12, autoAlpha: 0, duration: 0.22, ease: 'power2.in' });
  }

  function ejectDisk(then) {
    if (!inside || busy) return;
    const disk = inside;
    busy = true;
    os.ejectDisk();
    blink(2);
    const back = () => {
      disk.classList.remove('is-inside', 'is-moving');
      disk.setAttribute('aria-pressed', 'false');
      inside = null;
      busy = false;
      then?.();
    };
    if (reducedMotion) {
      gsap.set(disk, { x: 0, y: 0, scale: 1, scaleY: 1, rotation: home.get(disk), autoAlpha: 1 });
      back();
      return;
    }
    const cur = { x: gsap.getProperty(disk, 'x'), y: gsap.getProperty(disk, 'y') };
    disk.classList.add('is-moving');
    gsap
      .timeline({ onComplete: back })
      .set(disk, { autoAlpha: 1 })
      // pops out of the mouth…
      .to(disk, { scaleY: gsap.getProperty(disk, 'scaleX'), y: cur.y + disk.offsetHeight * 0.5, duration: 0.2, ease: 'ui-out' })
      // …and springs back to where it lives on the desk
      .to(disk, { x: 0, y: 0, scale: 1, rotation: home.get(disk), duration: 0.6, ease: 'back.out(1.4)' });
  }

  eject.addEventListener('click', () => (inside ? ejectDisk() : blink(1)));
  cleanups.push(
    os.on((type, detail) => {
      if (type === 'eject-request' || type === 'game-closed') inside && ejectDisk();
      if (type === 'need-disk') {
        const d = disks.find((x) => x.dataset.disk === detail);
        if (d && !reducedMotion) gsap.fromTo(d, { rotation: home.get(d) - 6 }, { rotation: home.get(d), duration: 0.5, ease: 'elastic.out(1.2, 0.3)' });
        d?.classList.add('is-hinted');
        setTimeout(() => d?.classList.remove('is-hinted'), 1800);
      }
    })
  );

  // Drag a disk; drop it on the slot to insert, anywhere else and it springs home.
  disks.forEach((disk) => {
    disk.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || busy || inside === disk) return;
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = gsap.getProperty(disk, 'x');
      const oy = gsap.getProperty(disk, 'y');
      let dragging = false;
      disk.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        if (!dragging && Math.hypot(dx, dy) > 5) {
          dragging = true;
          disk.classList.add('is-dragging');
          if (!reducedMotion) gsap.to(disk, { scale: 1.06, rotation: home.get(disk) * 0.3, duration: 0.2, ease: 'ui-out' });
        }
        if (!dragging) return;
        gsap.set(disk, { x: ox + dx, y: oy + dy });
        slot.classList.toggle('is-target', overSlot(disk));
      };
      const up = () => {
        disk.removeEventListener('pointermove', move);
        disk.removeEventListener('pointerup', up);
        disk.removeEventListener('pointercancel', up);
        slot.classList.remove('is-target');
        if (!dragging) return; // a plain click: handled by the click listener
        disk.classList.remove('is-dragging');
        disk.dataset.dragged = '1';
        if (overSlot(disk)) insert(disk);
        else gsap.to(disk, { x: 0, y: 0, scale: 1, rotation: home.get(disk), duration: reducedMotion ? 0 : 0.55, ease: 'back.out(1.5)' });
      };
      disk.addEventListener('pointermove', move);
      disk.addEventListener('pointerup', up);
      disk.addEventListener('pointercancel', up);
    });
    disk.addEventListener('click', () => {
      if (disk.dataset.dragged) {
        delete disk.dataset.dragged;
        return;
      }
      if (inside === disk) ejectDisk();
      else insert(disk);
    });
  });
  const overSlot = (disk) => {
    const s = slot.getBoundingClientRect();
    const r = disk.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return cx > s.left - 40 && cx < s.right + 40 && cy > s.top - 70 && cy < s.bottom + 60;
  };

  // ---------- gamepad keys ----------
  padBtns.forEach((btn) => {
    const key = btn.dataset.key;
    const down = (e) => {
      e.preventDefault();
      btn.classList.add('is-down');
      btn.setPointerCapture?.(e.pointerId);
      if (!os.state.gaming) {
        // not in a game yet: the keys still feel alive, and point at the disks
        os.state.on && os.state.app === 'work' && os.alert('Insert a floppy to play: drag one into the slot.', { icon: '◙' });
        return;
      }
      os.key(key, true);
    };
    const up = () => {
      if (!btn.classList.contains('is-down')) return;
      btn.classList.remove('is-down');
      if (os.state.gaming) os.key(key, false);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        down(e);
      }
    });
    btn.addEventListener('keyup', (e) => (e.key === 'Enter' || e.key === ' ') && up());
  });
  // Real arrow keys press the on-screen keys too, so you can see the link.
  const mirror = (e) => {
    if (!os.state.gaming) return;
    const btn = padBtns.find((b) => b.dataset.key === e.key);
    btn?.classList.toggle('is-down', e.type === 'keydown');
  };
  window.addEventListener('keydown', mirror);
  window.addEventListener('keyup', mirror);
  cleanups.push(() => {
    window.removeEventListener('keydown', mirror);
    window.removeEventListener('keyup', mirror);
  });

  return () => cleanups.forEach((fn) => fn());
}
