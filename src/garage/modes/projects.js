import { PROJECTS } from '../data/projects.js';
import { renderCheck, toggleCheck, turnCheck, leaveCheck, checkLeds } from '../radio-check.js';

// PROJECTS mode: one project per screen. Paddles step through them, OK opens the briefing
// (problem, approach, what I learned, links), OK again opens the code, BACK closes it.
// A project with `check` clips has a third level instead of opening the code: the radio check
// (radio-check.js), where the SCROLL dial is the model and the paddles change clip.
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const inCheck = ({ detail }) => detail === 'check';

export const projects = {
  id: 'projects',
  size: () => PROJECTS.length,
  count: ({ index }) => `${String(index + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')}`,
  render(body, state, ui) {
    const { index, detail } = state;
    const p = PROJECTS[index];
    if (inCheck(state)) return renderCheck(body, p, state, ui);
    leaveCheck();
    const head = `<p class="p-kind">${esc(p.kind)} · ${p.year}</p><h2 class="p-title">${esc(p.title)}</h2>`;
    if (!detail) {
      body.innerHTML = `<article>${head}<p class="p-summary">${esc(p.summary)}</p><ul class="p-stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></article>`;
      return;
    }
    const sec = (title, text) => (text ? `<section class="p-sec"><h3>${title}</h3><p>${esc(text)}</p></section>` : '');
    const links = [p.links.repo && `<a href="${p.links.repo}" target="_blank" rel="noopener">code on github ↗</a>`, p.links.live && `<a href="${p.links.live}" target="_blank" rel="noopener">live ↗</a>`].filter(Boolean).join('');
    const team = p.team ? `<p class="p-team">${esc(p.team)}</p>` : '';
    const check = p.check ? '<p class="p-check"><b>ok</b> radio check: hear it</p>' : '';
    body.innerHTML = `<article>${head}${team}${check}${sec('the question', p.problem)}${sec('how', p.approach)}${sec('what i learned', p.learned)}<ul class="p-stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="p-links">${links}</p></article>`;
  },
  hints(state) {
    // (phones have no SCROLL knob in view: the slider on the display is the dial)
    if (inCheck(state)) return '<span class="h-wide"><b>scroll</b> model</span><span class="h-compact"><b>slide</b> model</span><span><b>ok</b> play / stop</span><span><b>‹ ›</b> clip</span><span><b>back</b> briefing</span>';
    if (!state.detail) return '<span><b>‹ ›</b> paddles</span><span><b>ok</b> open the briefing</span>';
    const ok = PROJECTS[state.index].check ? 'radio check' : 'open the code';
    return `<span><b>ok</b> ${ok}</span><span><b>back</b> close</span><span><b>‹ ›</b> next project</span>`;
  },
  // printed labels that change with the level (the hotspots on the 3D wheel)
  labels: (state) => (inCheck(state) ? { scroll: 'model' } : null),
  ok(state) {
    const p = PROJECTS[state.index];
    if (!state.detail) return { detail: true };
    if (inCheck(state)) {
      toggleCheck();
      return null;
    }
    if (p.check) return { detail: 'check', clip: 0, autoplay: true, fresh: true };
    const url = p.links.repo || p.links.live;
    if (url) window.open(url, '_blank', 'noopener');
    return null;
  },
  back: (state) => (inCheck(state) ? { detail: true } : state.detail ? { detail: false } : null),
  // in the check the paddles change clip, not project
  step(state, delta) {
    if (!inCheck(state)) return null;
    const n = PROJECTS[state.index].check.length;
    return { clip: ((state.clip ?? 0) + delta + n) % n, autoplay: true };
  },
  // the SCROLL dial (↑ ↓, wheel, drag): the model's share in the check
  turn: (state, delta) => inCheck(state) && turnCheck(delta),
  leave: leaveCheck,
  leds: (state) => (inCheck(state) ? checkLeds() : Math.round(((state.index + 1) / PROJECTS.length) * 15)),
};
