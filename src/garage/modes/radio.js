// RADIO mode: team radio. A short exchange (with the ask: what Krish is looking for), then the ways
// to reach Krish, the cv first; paddles pick a row, OK opens it.
export const ROWS = [
  { label: 'cv', value: 'one page · pdf', href: '/assets/cv/krish-viramgama-cv.pdf', download: true },
  { label: 'email', value: 'krishviramgamatir@gmail.com', href: 'mailto:krishviramgamatir@gmail.com' },
  { label: 'linkedin', value: 'krish viramgama', href: 'https://www.linkedin.com/in/krish-viramgama-27951927a/' },
  { label: 'github', value: 'figureitoutkrish', href: 'https://github.com/figureitoutkrish' },
  { label: 'instagram', value: '@figureitoutwithkrish', href: 'https://www.instagram.com/figureitoutwithkrish/' },
];

// the ask: what Krish is looking for (the same line closes the quick lap)
export const ASK = 'i’m open to data science internships and freelance projects.';
export const attrs = (r) => (r.download ? ' download' : r.href.startsWith('http') ? ' target="_blank" rel="noopener"' : '');

export const radio = {
  id: 'radio',
  size: () => ROWS.length,
  count: ({ index }) => ROWS[index].label,
  render(body, { index }) {
    body.innerHTML = `<p class="radio-line"><b>krish</b><span>box, box. good job, that's the garage.</span></p>
      <p class="radio-line"><b>krish</b><span>${ASK}</span></p>
      <p class="radio-line"><b>you</b><span>copy. how do i reach you?</span></p>
      <p class="radio-line"><b>krish</b><span>the cv’s first on the list.</span></p>
      <ul class="radio-rows">${ROWS.map((r, i) => `<li><a class="${i === index ? 'sel' : ''}" href="${r.href}"${attrs(r)}>${r.label}<span>${r.value}</span></a></li>`).join('')}</ul>`;
  },
  hints: () => '<span><b>‹ ›</b> channel</span><span><b>ok</b> open</span>',
  ok({ index }) {
    const r = ROWS[index];
    if (r.download) {
      const a = Object.assign(document.createElement('a'), { href: r.href, download: '' });
      a.click();
    } else if (r.href.startsWith('mailto:')) location.href = r.href;
    else window.open(r.href, '_blank', 'noopener');
    return null;
  },
  back: () => null,
  leds: ({ index }) => Math.round(((index + 1) / ROWS.length) * 15),
};
