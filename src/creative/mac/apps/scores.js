import { getScores, submitScore } from '../../api-client.js';
import { checkName } from '../../name-rules.js';

// High Scores: top 10 for each game, shared by everyone (or this browser's, until the server is
// connected, which the footer says).
const GAMES = [
  { id: 'circle', label: 'Circle', unit: '%', fmt: (s) => `${s.toFixed(1)}%` },
  { id: 'racer', label: 'Racer', unit: 'm', fmt: (s) => `${Math.round(s)}m` },
];
const LAST_NAME = 'krish:player';

export function mountScores(body, { os }) {
  let game = os.state.lastGame || 'circle';
  body.classList.add('os__body--scores');
  body.innerHTML = `
    <div class="scores__tabs" role="tablist">
      ${GAMES.map((g) => `<button class="scores__tab" type="button" role="tab" data-game="${g.id}">${g.label}</button>`).join('')}
    </div>
    <ol class="scores__list" aria-live="polite"></ol>
    <p class="scores__foot"></p>`;
  const list = body.querySelector('.scores__list');
  const foot = body.querySelector('.scores__foot');
  let alive = true;

  async function load() {
    body.querySelectorAll('.scores__tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.game === game)));
    list.innerHTML = '<li class="scores__empty">loading…</li>';
    try {
      const { scores, local } = await getScores(game);
      if (!alive) return;
      const g = GAMES.find((x) => x.id === game);
      list.innerHTML = scores.length
        ? scores
            .map((s, i) => `<li class="${s.id && s.id === os.state.lastEntry ? 'is-you' : ''}"><span>${String(i + 1).padStart(2, '0')}</span><span class="scores__name"></span><span>${g.fmt(s.score)}</span></li>`)
            .join('')
        : '<li class="scores__empty">no scores yet. be the first!</li>';
      // Names are set as text, never as HTML.
      [...list.querySelectorAll('.scores__name')].forEach((el, i) => (el.textContent = scores[i].name));
      foot.textContent = local ? 'saved on this computer only (offline mode)' : 'everyone who played';
    } catch {
      list.innerHTML = '<li class="scores__empty">couldn’t load scores</li>';
    }
  }
  body.addEventListener('click', (e) => {
    const tab = e.target.closest('.scores__tab');
    if (!tab) return;
    game = tab.dataset.game;
    load();
  });
  load();
  return { unmount: () => (alive = false) };
}

// After a run: ask for a name, submit, then show the board.
export async function saveScore(os, game, score, proof) {
  let suggestion = '';
  try {
    suggestion = localStorage.getItem(LAST_NAME) || '';
  } catch {
    /* ignore */
  }
  for (;;) {
    const raw = await os.prompt('Your name or @handle for the high scores:', { maxLength: 16, placeholder: suggestion || 'e.g. @krish' });
    if (raw === null) return;
    const value = raw || suggestion;
    const { name, error } = checkName(value);
    if (error) {
      await os.alert(error);
      continue;
    }
    try {
      localStorage.setItem(LAST_NAME, name);
    } catch {
      /* ignore */
    }
    try {
      const res = await submitScore(game, name, score, proof);
      os.state.lastGame = game;
      os.state.lastEntry = res.entry?.id || res.scores?.find((s) => s.name === name && s.score === score)?.id;
      if (res.rank && res.rank <= 10) await os.alert(`You're #${res.rank}!`, { icon: '★' });
      else await os.alert('Saved. Not top 10 yet. Go again?', { icon: '✓' });
      os.open('scores');
    } catch (e) {
      await os.alert(e.message || 'Could not save that score.');
    }
    return;
  }
}
