import { randomUUID } from 'node:crypto';
import { getRedis } from './_lib/redis.js';
import { send, readBody, clientIp, visitor, rateLimited } from './_lib/http.js';
import { checkBoard } from '../src/creative/name-rules.js';

// The pit board in the data page's garage: visitors leave a short line for the next driver in.
//   GET   /api/pitboard   → { messages: newest 12 }
//   POST  /api/pitboard   { text } → { message }
// Anonymous (a random id kept in the browser, never returned). Same word rules as the notes.
const SHOW = 12;
const KEEP = 200;

export function createPitboardHandler(redisFactory = getRedis) {
  return async function handler(req, res) {
    const redis = redisFactory();
    if (!redis) return send(res, 503, { error: 'Pit board not connected yet', offline: true });

    if (req.method === 'GET') {
      const rows = await redis.lrange('board', 0, SHOW - 1);
      const messages = rows.map(parse).filter(Boolean).map(({ owner, ...m }) => m);
      return send(res, 200, { messages });
    }

    if (req.method === 'POST') {
      const me = visitor(req);
      if (!me) return send(res, 400, { error: 'Missing visitor id' });
      const { text, error } = checkBoard(readBody(req).text);
      if (error) return send(res, 400, { error });
      if (await rateLimited(redis, `board:${clientIp(req)}`, 3, 3600)) return send(res, 429, { error: 'That’s plenty for now. Come back later!' });
      const message = { id: randomUUID(), text, at: Date.now(), owner: me };
      await redis.lpush('board', JSON.stringify(message));
      await redis.ltrim('board', 0, KEEP - 1);
      const { owner, ...pub } = message;
      return send(res, 200, { message: pub });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  };
}

const parse = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

export default createPitboardHandler();
