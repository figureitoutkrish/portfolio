# Leaderboard, sticky notes & the pit board: one-time setup

The creative page's games (Perfect Circle, Racer) keep a **shared leaderboard**, and visitors can leave **sticky notes on the Mac** that everyone sees. On the data page, visitors can chalk a line on the **pit board** in the garage. All three run on small Vercel functions (`api/scores.js`, `api/notes.js`, `api/pitboard.js`) backed by **Upstash Redis** (free tier is plenty).

Until this is set up (and on `npm run dev`), everything still works: scores and notes are saved in each visitor's own browser, and the page says so ("offline mode" / "only you can see this for now").

## Turn it on (once, ~5 minutes)

1. **Vercel → Add New → Project →** import `figureitoutkrish/portfolio`. Framework preset: **Vite**. Deploy.
2. In the project: **Storage → Create / Connect → Upstash for Redis** (Marketplace) → free plan → connect it to this project. Vercel adds the env vars (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, `UPSTASH_REDIS_REST_URL` / `_TOKEN`, either with a prefix, or a plain `REDIS_URL`; all of them work, see `api/_lib/redis.js`).
3. Optional, for moderating notes from anywhere: **Settings → Environment Variables →** add `ADMIN_KEY` = any long random string.
4. **Redeploy.** Scores and notes are now shared.

## Moderating

- **Delete a note:** Upstash console → your database → Data Browser → hash `notes` → delete the field, and remove the same id from the sorted set `notes:t`. With `ADMIN_KEY` set you can also send `DELETE /api/notes?id=<id>` with the header `x-admin-key: <ADMIN_KEY>`.
- **Remove a pit board line:** list `board` → remove the entry (each is a JSON string with its id and text).
- **Remove a score:** sorted set `lb:circle` or `lb:racer` → remove the member (lower-cased name), and the same field in the hash `lbn:circle` / `lbn:racer`.

## What's protected

- Names: 1–16 characters (letters, numbers, `_ . @ -`), bad-word filter (English + Hindi, l33t-speak aware). Notes: max 60 characters, no links, same filter. Pit board: max 28 characters, same rules.
- Circle scores are recomputed on the server from the drawn points; machine-perfect circles are refused. Racer distances must be possible for the run's length.
- Rate limits: 12 score submissions per 10 min and 4 notes and 3 pit board lines per hour per IP. The board keeps its newest 200. One leaderboard row per name (your best counts). Only the newest 300 notes are kept.
- Visitors are anonymous (a random id in their browser); it's never shown to anyone.

## GitHub (the garage's commits monitor)

`api/github.js` reads Krish's public contribution calendar and recent commits; no setup needed. Vercel's edge caches it for 30 minutes. Optional: add a `GITHUB_TOKEN` env var (a fine-grained token with no permissions is enough) to raise GitHub's rate limit for the commit search.

Commits only count on the calendar if their author email is one of the emails on the GitHub account (github.com/settings/emails).
