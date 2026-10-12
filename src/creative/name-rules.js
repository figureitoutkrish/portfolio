// Who can sign the leaderboard / a sticky note. Shared by the page and the server (api/), which
// has the final say. Names: 1–16 characters, letters, numbers and _ . @ -. Text is checked
// against a small bad-word list after undoing common l33t swaps.
const SWAPS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };
// Matched anywhere (unambiguous)…
const ANYWHERE = [
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'whore', 'asshole', 'nigg', 'retard', 'chutiya', 'madarchod',
  'behenchod', 'bhenchod', 'bhosdi', 'gandu', 'randi',
];
// …and only as whole words (short ones that hide inside innocent names: "grape", "mcqueen").
const WORDS = ['dick', 'cock', 'slut', 'bastard', 'fag', 'rape', 'porn', 'nazi', 'lund', 'lauda', 'loda', 'harami', 'kutta', 'kamina', 'mc', 'bc', 'sex'];

const normalise = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => SWAPS[c] || c)
    .replace(/(.)\1{2,}/g, '$1$1');

export const isClean = (text) => {
  const t = normalise(text);
  const squashed = t.replace(/[^a-z]/g, '');
  const words = t.split(/[^a-z]+/).filter(Boolean);
  return !ANYWHERE.some((w) => squashed.includes(w)) && !words.some((w) => WORDS.includes(w));
};

export function checkName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { error: 'Type a name first.' };
  if (name.length > 16) return { error: 'Keep it to 16 characters.' };
  if (!/^[\p{L}\p{N}_.@\- ]+$/u.test(name)) return { error: 'Letters, numbers and _ . @ - only.' };
  if (!isClean(name)) return { error: "Let's keep it friendly." };
  return { name };
}

export function checkNote(raw) {
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return { error: 'Write something first.' };
  if (text.length > 60) return { error: 'Keep it short: 60 characters.' };
  if (/https?:\/\/|www\.|\.com\b/i.test(text)) return { error: 'No links on the notes.' };
  if (!isClean(text)) return { error: "Let's keep it friendly." };
  return { text };
}
