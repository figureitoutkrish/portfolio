// Krish's GitHub activity for the garage's "commits" monitor (src/garage/roam-ui.js).
//   GET /api/github → { user, days: [{ date, count, level }] (the last year), total, commits: [...] }
// Two public sources, no account needed:
//   the contribution calendar: github.com/users/<user>/contributions (each day's level and count)
//   recent commits: the commit search API (repo, message, date, link)
// Cached on Vercel's edge for 30 minutes (and served stale for a day while it refreshes), so GitHub
// is asked at most every half hour whoever is visiting. GITHUB_TOKEN, if set, raises GitHub's
// rate limit for the commit search.
const USER = 'figureitoutkrish';

export function createGithubHandler(fetchImpl = fetch) {
  return async function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return reply(res, 405, { error: 'Method not allowed' }, false);
    }
    const [calendar, commits] = await Promise.allSettled([getCalendar(fetchImpl), getCommits(fetchImpl)]);
    if (calendar.status === 'rejected' && commits.status === 'rejected') return reply(res, 502, { error: 'GitHub is not answering' }, false);
    const days = calendar.status === 'fulfilled' ? calendar.value : [];
    return reply(res, 200, {
      user: USER,
      days,
      total: days.reduce((a, d) => a + d.count, 0),
      commits: commits.status === 'fulfilled' ? commits.value : [],
    });
  };
}

function reply(res, status, body, cache = true) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', cache ? 'public, s-maxage=1800, stale-while-revalidate=86400' : 'no-store');
  res.status(status).send(JSON.stringify(body));
}

// the calendar: one <td data-date data-level id> per day, and a tooltip per day with the count
export async function getCalendar(fetchImpl = fetch) {
  const r = await fetchImpl(`https://github.com/users/${USER}/contributions`, { headers: { 'User-Agent': 'krish-portfolio' } });
  if (!r.ok) throw new Error(`calendar ${r.status}`);
  return parseCalendar(await r.text());
}
export function parseCalendar(html) {
  const counts = {};
  for (const m of html.matchAll(/for="(contribution-day-component-[\d-]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = /^(\d+) contribution/.exec(m[2].trim());
    counts[m[1]] = n ? Number(n[1]) : 0;
  }
  const days = [];
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"\s+id="(contribution-day-component-[\d-]+)"\s+data-level="(\d)"/g)) {
    days.push({ date: m[1], count: counts[m[2]] ?? 0, level: Number(m[3]) });
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function getCommits(fetchImpl = fetch) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'krish-portfolio' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetchImpl(`https://api.github.com/search/commits?q=author:${USER}&sort=author-date&order=desc&per_page=6`, { headers });
  if (!r.ok) throw new Error(`commits ${r.status}`);
  const { items = [] } = await r.json();
  return items.map((i) => ({
    repo: i.repository?.name || '',
    message: String(i.commit?.message || '').split('\n')[0].slice(0, 90),
    date: i.commit?.author?.date || null,
    url: i.html_url,
  }));
}

export default createGithubHandler();
