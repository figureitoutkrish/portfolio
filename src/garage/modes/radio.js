// RADIO mode: team radio. A short exchange, then the ways to reach Krish; paddles pick a row, OK
// opens it.
export const ROWS = [
  { label: 'email', value: 'krishviramgamatir@gmail.com', href: 'mailto:krishviramgamatir@gmail.com' },
  { label: 'linkedin', value: 'krish viramgama', href: 'https://www.linkedin.com/in/krish-viramgama-27951927a/' },
  { label: 'github', value: 'figureitoutkrish', href: 'https://github.com/figureitoutkrish' },
  { label: 'instagram', value: '@figureitoutwithkrish', href: 'https://www.instagram.com/figureitoutwithkrish/' },
];

export const radio = {
  id: 'radio',
  size: () => ROWS.length,
  count: ({ index }) => ROWS[index].label,
  render(body, { index }) {
    body.innerHTML = `<p class="radio-line"><b>krish</b><span>box, box. good job, that's the garage.</span></p>
      <p class="radio-line"><b>you</b><span>copy. how do i reach you?</span></p>
      <p class="radio-line"><b>krish</b><span>pick a channel.</span></p>
      <ul class="radio-rows">${ROWS.map((r, i) => `<li><a class="${i === index ? 'sel' : ''}" href="${r.href}"${r.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${r.label}<span>${r.value}</span></a></li>`).join('')}</ul>`;
  },
  hints: () => '<span><b>‹ ›</b> channel</span><span><b>ok</b> open</span>',
  ok({ index }) {
    const r = ROWS[index];
    if (r.href.startsWith('mailto:')) location.href = r.href;
    else window.open(r.href, '_blank', 'noopener');
    return null;
  },
  back: () => null,
  leds: ({ index }) => Math.round(((index + 1) / ROWS.length) * 15),
};
