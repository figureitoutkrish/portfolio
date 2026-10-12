import { randomUUID } from 'node:crypto';
import { getRedis } from './_lib/redis.js';
import { send, readBody, clientIp, visitor, rateLimited } from './_lib/http.js';
import { checkNote } from '../src/creative/name-rules.js';

// Sticky notes visitors leave on the Mac.
//   GET    /api/notes            → { notes: newest 30, yours flagged `mine` }
//   POST   /api/notes            { text, tone, pen } → { note }
//   PATCH  /api/notes?id=…       { pos: {x, y} }   (your own notes only)
//   DELETE /api/notes?id=…       (your own notes, or Krish with the x-admin-key header)
// Visitors are anonymous: a random id kept in their browser (x-visitor). It's never returned.
const TONES = ['canary', 'rose', 'tang', 'mint', 'sky'];
const PENS = ['pen', 'marker', 'label'];
const KEEP = 300;

export function createNotesHandler(redisFactory = getRedis) {
  return async function handler(req, res) {
    const redis = redisFactory();
    if (!redis) return send(res, 503, { error: 'Notes not connected yet', offline: true });
    const me = visitor(req);
    const isAdmin = !!process.env.ADMIN_KEY && req.headers['x-admin-key'] === process.env.ADMIN_KEY;

    if (req.method === 'GET') {
      const ids = await redis.zrange('notes:t', 0, 29, { rev: true });
      if (!ids.length) return send(res, 200, { notes: [] });
      const rows = await redis.hmget('notes', ...ids);
      const notes = ids
        .map((id, i) => parse(rows?.[id] ?? rows?.[i]))
        .filter(Boolean)
        .map(({ owner, ...n }) => ({ ...n, mine: !!me && owner === me }));
      return send(res, 200, { notes });
    }

    if (req.method === 'POST') {
      if (!me) return send(res, 400, { error: 'Missing visitor id' });
      const body = readBody(req);
      const { text, error } = checkNote(body.text);
      if (error) return send(res, 400, { error });
      if (await rateLimited(redis, `note:${clientIp(req)}`, 4, 3600)) return send(res, 429, { error: 'That’s plenty of notes for now. Come back later!' });
      const note = {
        id: randomUUID(),
        text,
        tone: TONES.includes(body.tone) ? body.tone : 'canary',
        pen: PENS.includes(body.pen) ? body.pen : 'pen',
        at: Date.now(),
        owner: me,
      };
      await redis.hset('notes', { [note.id]: JSON.stringify(note) });
      await redis.zadd('notes:t', { score: note.at, member: note.id });
      // keep the store small: drop the oldest beyond KEEP
      const count = await redis.zcard('notes:t');
      if (count > KEEP) {
        const old = await redis.zrange('notes:t', 0, count - KEEP - 1);
        if (old.length) {
          await redis.zrem('notes:t', ...old);
          await redis.hdel('notes', ...old);
        }
      }
      const { owner, ...pub } = note;
      return send(res, 200, { note: { ...pub, mine: true } });
    }

    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const id = String(req.query?.id || '');
      const note = parse(await redis.hget('notes', id));
      if (!note) return send(res, 404, { error: 'Not found' });
      if (!(isAdmin || (me && note.owner === me))) return send(res, 403, { error: 'Not your note' });
      if (req.method === 'DELETE') {
        await redis.zrem('notes:t', id);
        await redis.hdel('notes', id);
        return send(res, 200, { ok: true });
      }
      const { pos } = readBody(req);
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return send(res, 400, { error: 'Bad position' });
      note.pos = { x: Math.max(-600, Math.min(600, Math.round(pos.x))), y: Math.max(-600, Math.min(600, Math.round(pos.y))) };
      await redis.hset('notes', { [id]: JSON.stringify(note) });
      return send(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return send(res, 405, { error: 'Method not allowed' });
  };
}

const parse = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default createNotesHandler();
