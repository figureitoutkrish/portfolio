import gsap from 'gsap';

// Header menu: a panel that grows out of the burger button (transform-origin: top right).
// Every open/close tweens from the panel's current on-screen state, so toggling mid-animation
// reverses smoothly instead of jumping.
export function initMenu({ reducedMotion }) {
  const button = document.querySelector('.menu-btn');
  const panel = document.getElementById(button?.getAttribute('aria-controls'));
  if (!button || !panel) return () => {};

  const links = panel.querySelectorAll('a');
  let open = false;

  // Dropdown timing: 220ms in, a quicker 150ms out, both ease-out (never ease-in).
  // Keyboard-driven open/close (Enter, Space, Escape) is instant — keyboard actions shouldn't wait on animation.
  function setOpen(next, { returnFocus = true, instant = false } = {}) {
    if (next === open) return;
    open = next;
    button.setAttribute('aria-expanded', String(open));
    const still = instant || reducedMotion;

    if (open) {
      // Visible right away (only opacity/scale animate) so focus can move into the menu now.
      gsap.set(panel, { visibility: 'visible' });
      gsap.to(panel, { opacity: 1, scale: 1, y: 0, duration: still ? 0 : 0.22, ease: 'ui-out', overwrite: true });
      if (!still) {
        gsap.fromTo(links, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.22, ease: 'ui-out', stagger: 0.03, delay: 0.03, overwrite: true });
      } else {
        gsap.set(links, { opacity: 1, y: 0 });
      }
      links[0]?.focus({ preventScroll: true });
    } else {
      gsap.to(panel, {
        autoAlpha: 0,
        scale: reducedMotion ? 1 : 0.96,
        y: reducedMotion ? 0 : -6,
        duration: still ? 0 : 0.15,
        ease: 'ui-out',
        overwrite: true,
      });
      if (returnFocus) button.focus({ preventScroll: true });
    }
  }

  gsap.set(panel, { autoAlpha: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : -6 });

  // e.detail === 0 means the click came from the keyboard (Enter/Space), not a pointer.
  const onButton = (e) => setOpen(!open, { instant: e.detail === 0 });
  const onKey = (e) => {
    if (e.key === 'Escape' && open) setOpen(false, { instant: true });
  };
  // Clicking anywhere outside closes it, without stealing focus back to the button.
  const onPointer = (e) => {
    if (open && !panel.contains(e.target) && !button.contains(e.target)) setOpen(false, { returnFocus: false });
  };
  // Tabbing out of the panel closes it.
  const onFocusOut = (e) => {
    if (open && !panel.contains(e.relatedTarget) && e.relatedTarget !== button) setOpen(false, { returnFocus: false });
  };

  button.addEventListener('click', onButton);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPointer);
  panel.addEventListener('focusout', onFocusOut);

  return () => {
    button.removeEventListener('click', onButton);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer);
    panel.removeEventListener('focusout', onFocusOut);
  };
}
