import { PIECES } from './generative.js';

// The record player's crate. A record either streams from Spotify (`spotify`, below) or plays
// its own files from src/assets/music/<id>/:
// drop audio files in (AAC .m4a or .mp3, ~128 kbps) and they appear automatically, in name
// order. Name files "01 Artist - Title.m4a" (the number only sets the order). Only use music
// Krish has the rights to play here.
const FILES = import.meta.glob('../assets/music/*/*.{m4a,mp3,ogg}', { eager: true, query: '?url', import: 'default' });

const trackFrom = (path, src) => {
  const base = decodeURIComponent(path.split('/').pop()).replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]*/, '');
  const [artist, ...rest] = base.split(' - ');
  return rest.length ? { title: rest.join(' - '), artist, src } : { title: base, artist: 'krish’s crate', src };
};

// `gen`: the record is written live in the browser (src/audio/generative.js): offline, free for all.
// `spotify`: the record plays through Spotify's official embed instead (full songs for visitors
// logged into Spotify in that browser, 30-second previews for everyone else; Spotify's rule).
const RECORDS_BASE = [
  { id: 'lofi', title: 'Lo-fi focus', note: 'minecraft-style', color: '#7fc96b', ink: '#1d3a17', gen: true },
  { id: 'race-day', title: 'Race day', note: 'f1 the album', color: '#e4241b', ink: '#fff', spotify: 'spotify:album:2HwRKkEp7jXbxXwcGyZYHK' },
  { id: 'late-night', title: 'Late night', note: 'red bull o’clock', color: '#2c5cff', ink: '#fff', spotify: 'spotify:playlist:0nB57Lwi9cZx6l0mbbM0JZ' },
  { id: 'picks', title: 'Krish’s picks', note: 'die trying · drake', color: '#b6ed68', ink: '#20221f', spotify: 'spotify:track:0NUqi0ps17YpLUC3kgsZq0' },
];

export const RECORDS = RECORDS_BASE.map((r) => ({
  ...r,
  tracks: r.gen
    ? PIECES.map((p) => ({ title: p.title, artist: p.artist }))
    : Object.entries(FILES)
        .filter(([path]) => path.includes(`/music/${r.id}/`))
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([path, src]) => trackFrom(path, src)),
}));
