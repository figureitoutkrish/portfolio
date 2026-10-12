// Small helpers shared by the API functions.
export const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
};

export const readBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
};

export const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

export const visitor = (req) => {
  const v = String(req.headers['x-visitor'] || '');
  return /^[\w-]{6,64}$/.test(v) ? v : null;
};

// Fixed-window rate limit: `limit` calls per `windowSec` per key.
export async function rateLimited(redis, key, limit, windowSec) {
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n > limit;
}
