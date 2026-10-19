import { Redis } from '@upstash/redis';
import { createClient } from 'redis';

// The store behind the leaderboard, the sticky notes and the pit board. Two ways in, depending on
// how Redis was connected on Vercel:
//   Upstash REST   UPSTASH_REDIS_REST_URL + _TOKEN, or KV_REST_API_URL + _TOKEN (any prefix)
//   any Redis      REDIS_URL (a redis:// or rediss:// connection string), through node-redis,
//                  wrapped so it answers the same calls the functions make to Upstash
// Returns null when neither is set; the page then uses its offline fallback.
let client;
const find = (suffixes) => {
  for (const s of suffixes) if (process.env[s]) return process.env[s];
  const key = Object.keys(process.env).find((k) => suffixes.some((s) => k.endsWith(`_${s}`)) && process.env[k]);
  return key ? process.env[key] : undefined;
};
export function getRedis() {
  if (client !== undefined) return client;
  const url = find(['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL']);
  const token = find(['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN']);
  if (url && token) client = new Redis({ url, token });
  else if (find(['REDIS_URL'])) client = tcpRedis(find(['REDIS_URL']));
  else client = null;
  return client;
}

// node-redis behind the Upstash-style calls api/*.js use. One connection per warm function,
// opened on first use.
function tcpRedis(url) {
  const c = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: (n) => (n > 2 ? false : 200) } });
  c.on('error', () => {}); // (a failed call rejects on its own; don't crash the function)
  let ready = null;
  const conn = () => (ready ??= c.connect().catch((e) => ((ready = null), Promise.reject(e))));
  const run = (fn) => conn().then(fn);
  const list = (xs) => xs.flat();
  return {
    incr: (k) => run(() => c.incr(k)),
    expire: (k, s) => run(() => c.expire(k, s)),
    hget: (k, f) => run(() => c.hGet(k, f)),
    hmget: (k, ...f) => run(() => c.hmGet(k, list(f))), // an array, in field order
    hset: (k, obj) => run(() => c.hSet(k, obj)),
    hdel: (k, ...f) => run(() => c.hDel(k, list(f))),
    lpush: (k, ...v) => run(() => c.lPush(k, list(v))),
    lrange: (k, a, b) => run(() => c.lRange(k, a, b)),
    ltrim: (k, a, b) => run(() => c.lTrim(k, a, b)),
    zadd: (k, { score, member }) => run(() => c.zAdd(k, { score, value: member })),
    zcard: (k) => run(() => c.zCard(k)),
    zscore: (k, m) => run(() => c.zScore(k, m)),
    zrevrank: (k, m) => run(() => c.zRevRank(k, m)),
    zrem: (k, ...m) => run(() => c.zRem(k, list(m))),
    // Upstash returns [member, score, member, score…] for withScores
    zrange: (k, a, b, { rev = false, withScores = false } = {}) =>
      run(async () => {
        const opts = rev ? { REV: true } : undefined;
        if (!withScores) return c.zRange(k, a, b, opts);
        const rows = await c.zRangeWithScores(k, a, b, opts);
        return rows.flatMap((r) => [r.value, r.score]);
      }),
  };
}
