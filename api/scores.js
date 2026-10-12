import { getRedis } from './_lib/redis.js';
import { send, readBody, clientIp, rateLimited } from './_lib/http.js';
import { checkName } from '../src/creative/name-rules.js';
import { scoreCircle, CIRCLE_MAX_SCORE } from '../src/creative/mac/apps/circle-score.js';

// Leaderboard for the Mac's games.
//   GET  /api/scores?game=circle|racer  → { scores: top 10 }
//   POST /api/scores { game, name, score, proof } → { entry, scores, rank }
// One row per name per game (your best counts). Circle scores are re-computed from the drawn
// points, racer distances must be possible for the run's duration.
const GAMES = ['circle', 'racer'];
const RACER_MAX_MPS = 150; // fastest the score can climb, metres per second: top speed + bonuses (with headroom)

export function createScoresHandler(redisFactory = getRedis) {
  return async function handler(req, res) {
    const redis = redisFactory();
    if (!redis) return send(res, 503, { error: 'Leaderboard not connected yet', offline: true });

    if (req.method === 'GET') {
      const game = String(req.query?.game || '');
      if (!GAMES.includes(game)) return send(res, 400, { error: 'Unknown game' });
      return send(res, 200, { scores: await top(redis, game) });
    }

    if (req.method === 'POST') {
      const { game, name: rawName, score: claimed, proof } = readBody(req);
      if (!GAMES.includes(game)) return send(res, 400, { error: 'Unknown game' });
      const { name, error } = checkName(rawName);
      if (error) return send(res, 400, { error });
      if (await rateLimited(redis, `score:${clientIp(req)}`, 12, 600)) return send(res, 429, { error: 'Slow down a little. Try again in a few minutes.' });

      let score;
      if (game === 'circle') {
        const pts = proof?.points;
        const valid = Array.isArray(pts) && pts.length <= 4000 && pts.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
        if (!valid || !Number.isFinite(proof.w) || !Number.isFinite(proof.h)) return send(res, 400, { error: 'That drawing didn’t come through' });
        const r = scoreCircle(pts, [proof.w / 2, proof.h / 2], Math.min(proof.w, proof.h));
        if (r.error) return send(res, 400, { error: r.error });
        if (r.score >= CIRCLE_MAX_SCORE) return send(res, 400, { error: 'Too perfect to be human 🤖' });
        if (Math.abs(r.score - Number(claimed)) > 0.5) return send(res, 400, { error: 'Score mismatch' });
        score = r.score;
      } else {
        const dist = Math.round(Number(claimed));
        const duration = Number(proof?.duration);
        if (!Number.isFinite(dist) || dist <= 0 || !Number.isFinite(duration) || duration <= 0) return send(res, 400, { error: 'That run didn’t come through' });
        if (dist > (duration / 1000) * RACER_MAX_MPS) return send(res, 400, { error: 'That run looks too fast' });
        score = dist;
      }

      const key = name.toLowerCase();
      const prev = await redis.zscore(`lb:${game}`, key);
      const at = Date.now();
      if (prev === null || score > Number(prev)) {
        await redis.zadd(`lb:${game}`, { score, member: key });
        await redis.hset(`lbn:${game}`, { [key]: JSON.stringify({ name, score, at }) });
      }
      const rank = (await redis.zrevrank(`lb:${game}`, key)) + 1;
      return send(res, 200, { entry: { id: key, name, score }, best: Math.max(score, Number(prev ?? 0)), rank, scores: await top(redis, game) });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  };
}

async function top(redis, game) {
  const flat = await redis.zrange(`lb:${game}`, 0, 9, { rev: true, withScores: true });
  const keys = [];
  for (let i = 0; i < flat.length; i += 2) keys.push(flat[i]);
  if (!keys.length) return [];
  const rows = await redis.hmget(`lbn:${game}`, ...keys);
  return keys.map((k, i) => {
    const raw = rows?.[k] ?? rows?.[i];
    const row = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
    return { id: k, name: row.name || k, score: Number(flat[i * 2 + 1]), at: row.at || 0 };
  });
}

export default createScoresHandler();
