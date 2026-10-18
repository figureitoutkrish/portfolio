import { Redis } from '@upstash/redis';

// Upstash Redis from the env vars Vercel's Upstash integration adds. Their names depend on how it
// was connected (UPSTASH_REDIS_REST_URL, KV_REST_API_URL, or either with a custom prefix such as
// STORAGE_KV_REST_API_URL), so look for any pair that ends the right way.
// Returns null when the store isn't connected yet; the page then uses its offline fallback.
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
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}
