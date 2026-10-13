// The record player's crate. Each record is a folder of tracks in src/assets/music/<id>/:
// drop audio files in (AAC .m4a or .mp3, ~128 kbps) and they appear automatically, in name
// order. Name files "01 Artist - Title.m4a" (the number only sets the order). Only use music
// Krish has the rights to play here.
const FILES = import.meta.glob('../assets/music/*/*.{m4a,mp3,ogg}', { eager: true, query: '?url', import: 'default' });

const trackFrom = (path, src) => {
  const base = decodeURIComponent(path.split('/').pop()).replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]*/, '');
  const [artist, ...rest] = base.split(' - ');
  return rest.length ? { title: rest.join(' - '), artist, src } : { title: base, artist: 'krish’s crate', src };
};

const RECORDS_BASE = [
  { id: 'lofi', title: 'Lo-fi focus', note: 'for reading the work', color: '#c9b8ff', ink: '#2b2340' },
  { id: 'race-day', title: 'Race day', note: 'pedal down', color: '#e4241b', ink: '#fff' },
  { id: 'late-night', title: 'Late night', note: 'red bull o’clock', color: '#2c5cff', ink: '#fff' },
  { id: 'picks', title: 'Krish’s picks', note: 'on repeat', color: '#b6ed68', ink: '#20221f' },
];

export const RECORDS = RECORDS_BASE.map((r) => ({
  ...r,
  tracks: Object.entries(FILES)
    .filter(([path]) => path.includes(`/music/${r.id}/`))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([path, src]) => trackFrom(path, src)),
}));
