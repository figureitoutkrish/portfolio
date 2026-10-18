import { visitorId } from '../creative/api-client.js';
import { checkBoard } from '../creative/name-rules.js';

// The garage's pit board (api/pitboard.js on Vercel + Upstash). Without the function (local dev,
// or before Upstash is connected) it keeps the board in this browser and says so (`local: true`).
const LOCAL = 'krish:pitboard';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL)) || [];
  } catch {
    return [];
  }
};
const write = (list) => {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* private mode: it just won't persist */
  }
};

async function call(init) {
  const res = await fetch('/api/pitboard', { ...init, headers: { 'Content-Type': 'application/json', 'x-visitor': visitorId() } });
  const json = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!json || json.offline) throw new Error('no api');
  if (!res.ok) {
    const err = new Error(json.error || 'Something went wrong');
    err.server = true;
    throw err;
  }
  return json;
}

export async function getBoard() {
  try {
    const { messages } = await call();
    return { messages, local: false };
  } catch (e) {
    if (e.server) throw e;
    return { messages: read(), local: true };
  }
}

export async function postBoard(raw) {
  const { text, error } = checkBoard(raw); // the server checks again; this answers instantly
  if (error) throw new Error(error);
  try {
    return await call({ method: 'POST', body: JSON.stringify({ text }) });
  } catch (e) {
    if (e.server) throw e;
    const message = { id: `local-${Date.now()}`, text, at: Date.now() };
    write([message, ...read()]);
    return { message, local: true };
  }
}
