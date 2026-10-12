// The section toolbar: links scroll smoothly (Lenis), and the section you're reading is marked.
export function initToolbar({ lenis }) {
  const bar = document.querySelector('.ctool');
  if (!bar) return () => {};
  const links = [...bar.querySelectorAll('a[href^="#"]')];
  const sections = links
    .map((a) => document.getElementById(a.hash.slice(1)))
    .filter(Boolean);

  const onClick = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.getElementById(a.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target); // sections carry scroll-margin-top for the sticky toolbar
    else target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', a.hash === '#top' ? location.pathname : a.hash);
  };
  // Every in-page link on this page scrolls the same way (hero buttons too).
  document.addEventListener('click', onClick);

  // Current section: the last one whose top has passed a third of the screen.
  const mark = () => {
    const line = window.innerHeight / 3;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    links.forEach((a) => {
      const on = current && a.hash === `#${current.id}` && a.hash !== '#top';
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', mark, { passive: true });
  mark();

  return () => {
    document.removeEventListener('click', onClick);
    window.removeEventListener('scroll', mark);
  };
}
