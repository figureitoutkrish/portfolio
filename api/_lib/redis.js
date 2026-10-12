import { Redis } from '@upstash/redis';

// Upstash Redis from the env vars Vercel's Upstash integration adds (either naming).
// Returns null when the store isn't connected yet; the page then uses its offline fallback.
let client;
export function getRedis() {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}
