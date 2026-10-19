// Talks to the leaderboard and sticky-note functions (api/scores.js, api/notes.js on Vercel +
// Upstash Redis). When they aren't there yet (local dev, or before Upstash is connected) it falls
// back to this browser's storage and says so (`local: true`), so everything stays playable.
const LOCAL_SCORES = 'krish:scores';
const LOCAL_NOTES = 'krish:notes';
const VISITOR = 'krish:visitor';

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: it just won't persist */
  }
};

export function visitorId() {
  let id = read(VISITOR, null);
  if (!id) {
    id = crypto.randomUUID?.() || String(Math.random()).slice(2);
    write(VISITOR, id);
  }
  return id;
}

async function call(path, init) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-visitor': visitorId(), ...(init?.headers || {}) },
  });
  const json = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  // no api: the dev server answers /api with HTML or a 404; before Upstash is connected the
  // functions answer 503 { offline: true }. Either way: use this browser's storage.
  if (!json || json.offline) throw new Error('no api');
  if (!res.ok) {
    const err = new Error(json.error || 'Something went wrong');
    err.status = res.status;
    err.server = true;
    throw err;
  }
  return json;
}

// ---------- scores ----------
const sortScores = (list) => list.sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10);

export async function getScores(game) {
  try {
    const { scores } = await call(`/api/scores?game=${game}`);
    return { scores, local: false };
  } catch (e) {
    if (e.server) throw e;
    return { scores: sortScores(read(LOCAL_SCORES, {})[game] || []), local: true };
  }
}

export async function submitScore(game, name, score, proof) {
  try {
    const res = await call('/api/scores', { method: 'POST', body: JSON.stringify({ game, name, score, proof }) });
    return { ...res, local: false };
  } catch (e) {
    if (e.server) throw e;
    const all = read(LOCAL_SCORES, {});
    const entry = { name, score, at: Date.now(), id: String(Date.now()) };
    all[game] = sortScores([...(all[game] || []), entry]);
    write(LOCAL_SCORES, all);
    return { scores: all[game], rank: all[game].indexOf(entry) + 1, local: true };
  }
}

// ---------- sticky notes ----------
export async function getNotes() {
  try {
    const res = await call('/api/notes');
    return { ...res, local: false };
  } catch (e) {
    if (e.server) throw e;
    return { notes: read(LOCAL_NOTES, []).slice(-3).reverse(), local: true };
  }
}

export async function postNote(note) {
  try {
    const res = await call('/api/notes', { method: 'POST', body: JSON.stringify(note) });
    return { ...res, local: false };
  } catch (e) {
    if (e.server) throw e;
    const saved = { ...note, id: `local-${Date.now()}`, mine: true, at: Date.now() };
    write(LOCAL_NOTES, [...read(LOCAL_NOTES, []), saved].slice(-3)); // (the Mac holds three)
    return { note: saved, local: true };
  }
}

export async function deleteNote(id) {
  if (id.startsWith('local-')) {
    write(LOCAL_NOTES, read(LOCAL_NOTES, []).filter((n) => n.id !== id));
    return;
  }
  try {
    await call(`/api/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    /* already gone */
  }
}

export async function moveNote(id, pos) {
  if (id.startsWith('local-')) {
    write(LOCAL_NOTES, read(LOCAL_NOTES, []).map((n) => (n.id === id ? { ...n, pos } : n)));
    return;
  }
  try {
    await call(`/api/notes?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ pos }) });
  } catch {
    /* position just won't stick */
  }
}
