// The Content section: @figureitoutwithkrish on Instagram. Numbers are from Krish's own
// Instagram insights (Edits app), exported 13 Oct 2026: the "Content · 2 years · by views" list
// and the full exports for the top three reels. Update them here when there's a newer export.
//
// `url`: the reel's link (Share → Copy link). Until a link is added, a row opens the profile's
// reels tab. `cover` (9:16) only for reels with a full export; `thumb` (square) for the rest.
import PLACEHOLDERS from './placeholders.json';

export const PROFILE = 'https://www.instagram.com/figureitoutwithkrish/';
export const AS_OF = 'Oct 2026';

const cover = (n) => ({ src: `/assets/content/reel-${n}.webp`, lqip: PLACEHOLDERS[`content/reel-${n}`] });
const thumb = (n) => `/assets/content/thumb-${String(n).padStart(2, '0')}.webp`;

// theme → its colour on the standings board (like a team colour)
export const THEMES = {
  relatable: { label: 'relatable', color: '#b6ed68' },
  sports: { label: 'f1 & football', color: '#e4241b' },
  story: { label: 'story', color: '#3aa0ff' },
  nostalgia: { label: 'nostalgia', color: '#ffd23a' },
  music: { label: 'music', color: '#c9b8ff' },
  brand: { label: 'brand', color: '#ff8a3d' },
};

export const REELS = [
  {
    title: 'so close to 100 million!!!! but this is me after every exam',
    url: 'https://www.instagram.com/p/DRhjK7IDAEH/',
    hook: 'Wyd after exam? Me:',
    theme: 'relatable',
    views: 13_600_000,
    likes: 1_300_000,
    comments: 685,
    shares: 219_000,
    saves: 25_000,
    reposts: 97_000,
    reached: 8_000_000,
    watch: 6.4,
    length: 6,
    posted: '26 Nov 2025',
    cover: cover(1),
    thumb: '/assets/content/reel-1.webp',
  },
  {
    title: 'check the reel covers 😏',
    url: 'https://www.instagram.com/p/DUVuQTDDDrp/',
    hook: 'They weren’t supposed to WIN',
    theme: 'sports',
    views: 391_000,
    likes: 42_400,
    comments: 12_000,
    shares: 7_000,
    saves: 4_400,
    reposts: 551,
    watch: 12.55,
    length: 23,
    posted: '4 Feb 2026',
    cover: cover(2),
    thumb: '/assets/content/reel-2.webp',
  },
  { title: 'and no, we didn’t sneak in 😭', theme: 'story', views: 264_000, likes: 13_800, comments: 50, shares: 8_700, thumb: thumb(3) },
  {
    title: 'let them have a little rest too',
    hook: 'POV: i left my exam paper blank so the teachers can spend more time with their families',
    theme: 'relatable',
    views: 180_000,
    likes: 6_000,
    comments: 38,
    shares: 3_200,
    saves: 181,
    reached: 93_000,
    watch: 6.24,
    length: 8,
    posted: '15 Nov 2025',
    cover: cover(3),
    thumb: '/assets/content/reel-3.webp',
  },
  { title: '@lando what have you done to these guys', theme: 'sports', views: 168_000, likes: 9_000, comments: 377, shares: 2_400, thumb: thumb(5) },
  { title: 'sir questioning his life after a glance', theme: 'relatable', views: 117_000, likes: 6_000, comments: 92, shares: 4_900, thumb: thumb(6) },
  { title: 'this should be on spotify atp', theme: 'music', views: 42_600, likes: 1_100, comments: 18, shares: 309, thumb: thumb(7) },
  { title: 'summer 2018 vibes', theme: 'nostalgia', views: 39_800, likes: 2_800, comments: 33, shares: 825, thumb: thumb(8) },
  { title: 'pov: you made it with the boys', theme: 'relatable', views: 30_200, likes: 2_000, comments: 49, shares: 749, thumb: thumb(9) },
  { title: '@mcdonalds_india might be the reason', theme: 'brand', views: 23_200, likes: 1_500, comments: 5, shares: 1_100, thumb: thumb(10) },
  { title: '2026 is gonna be my year 😭🙏', theme: 'nostalgia', views: 22_200, likes: 854, comments: 58, shares: 403, thumb: thumb(11) },
  { title: 'im team oscar now!!!!', theme: 'sports', views: 21_900, likes: 1_200, comments: 73, shares: 349 },
  { title: 'i can’t believe this was possible', theme: 'story', views: 20_600 },
];

// Totals across the reels above (a floor: only the top 13 are counted).
const sum = (k) => REELS.reduce((a, r) => a + (r[k] || 0), 0);
export const TOTALS = { reels: REELS.length, views: sum('views'), likes: sum('likes'), shares: sum('shares'), comments: sum('comments') };
export const FOLLOWERS = 2_400;
export const LAST_90 = { views: 320_431, viewers: 198_956 };

export const compact = (n) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(n);
};
