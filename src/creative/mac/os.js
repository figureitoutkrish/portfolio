// The vintage Mac's operating system. M1: the live menu-bar clock. Apps, windows, the physical
// controls and the games arrive in later milestones.
export function initMac() {
  const os = document.querySelector('[data-os]');
  if (!os) return () => {};
  const clock = os.querySelector('.os__clock');
  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clock.dateTime = d.toISOString();
  };
  tick();
  const timer = setInterval(tick, 15000);
  return () => clearInterval(timer);
}
