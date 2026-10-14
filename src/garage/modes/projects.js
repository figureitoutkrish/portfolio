import { PROJECTS } from '../data/projects.js';

// PROJECTS mode: one project per screen. Paddles step through them, OK opens the briefing
// (problem, approach, what I learned, links), OK again opens the code, BACK closes it.
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const projects = {
  id: 'projects',
  size: () => PROJECTS.length,
  count: ({ index }) => `${String(index + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')}`,
  render(body, { index, detail }) {
    const p = PROJECTS[index];
    const head = `<p class="p-kind">${esc(p.kind)} · ${p.year}</p><h2 class="p-title">${esc(p.title)}</h2>`;
    if (!detail) {
      body.innerHTML = `<article>${head}<p class="p-summary">${esc(p.summary)}</p><ul class="p-stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></article>`;
      return;
    }
    const sec = (title, text) => (text ? `<section class="p-sec"><h3>${title}</h3><p>${esc(text)}</p></section>` : '');
    const links = [p.links.repo && `<a href="${p.links.repo}" target="_blank" rel="noopener">code on github ↗</a>`, p.links.live && `<a href="${p.links.live}" target="_blank" rel="noopener">live ↗</a>`].filter(Boolean).join('');
    body.innerHTML = `<article>${head}${sec('the question', p.problem)}${sec('how', p.approach)}${sec('what i learned', p.learned)}<ul class="p-stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="p-links">${links}</p></article>`;
  },
  hints: ({ detail }) => (detail ? '<span><b>ok</b> open the code</span><span><b>back</b> close</span><span><b>‹ ›</b> next project</span>' : '<span><b>‹ ›</b> paddles</span><span><b>ok</b> open the briefing</span>'),
  ok({ index, detail }) {
    if (!detail) return { detail: true };
    const url = PROJECTS[index].links.repo || PROJECTS[index].links.live;
    if (url) window.open(url, '_blank', 'noopener');
    return null;
  },
  back: ({ detail }) => (detail ? { detail: false } : null),
  leds: ({ index }) => Math.round(((index + 1) / PROJECTS.length) * 15),
};
