// The miniature Mac in the hero. M1: the live menu-bar clock. Apps, windows and the dock
// arrive in a later milestone.
export function initMiniMac() {
  const mac = document.querySelector('[data-mac]');
  if (!mac) return () => {};
  const clock = mac.querySelector('.mac__clock');
  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clock.dateTime = d.toISOString();
  };
  tick();
  const timer = setInterval(tick, 15000);
  return () => clearInterval(timer);
}
