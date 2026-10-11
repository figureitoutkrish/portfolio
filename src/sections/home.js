import gsap from 'gsap';

// Landing page. Its entrance is a timeline the intro plays once the wipe uncovers it.
export function initHome() {
  const root = document.querySelector('.home');
  const lines = root.querySelectorAll('.home__name .line > span');
  const fades = root.querySelectorAll('[data-fade]');
  const photo = root.querySelector('.home__photo');
  const img = photo.querySelector('img');

  return {
    hide() {
      gsap.set(lines, { yPercent: 110 });
      gsap.set(fades, { autoAlpha: 0, y: 16 });
      gsap.set(photo, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(img, { scale: 1.15 });
    },

    // Name rises through its line masks, photo opens bottom → top (following the wipe).
    reveal() {
      return gsap
        .timeline()
        .to(photo, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'ui-in-out' }, 0)
        .to(img, { scale: 1, duration: 1.4, ease: 'ui-out' }, 0)
        .to(lines, { yPercent: 0, duration: 0.9, ease: 'ui-out', stagger: 0.07 }, 0.15)
        .to(fades, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'ui-out', stagger: 0.04 }, 0.4);
    },
  };
}
