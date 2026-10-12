// Talk to Krish: a scripted chat (no AI, no server). Topics and answers come from
// content/about.md; typed questions are matched by keywords; anything else points to Instagram.
// Hidden: ask about "6th grade" / "first thumbnail" for the origin story.
const IG = 'https://www.instagram.com/figureitoutwithkrish/';

export const TOPICS = [
  {
    id: 'what',
    chip: 'what do you do?',
    keys: ['what do you do', 'who are you', 'do you do', 'about you', 'yourself', 'intro', 'hello', 'hi', 'hey'],
    answer: "I design thumbnails, build brands and make content. That's this side of me. The other side studies data science. Scroll down for the work.",
  },
  {
    id: 'koach',
    chip: 'what is koach?',
    keys: ['koach', 'agency', 'studio', 'company', 'business', 'cofound', 'co-found'],
    answer: 'Koach is the content and creative agency I co-founded in February 2025. We help brands with their content and help them scale. Peeyo, Endura and Atovio in the grid below are Koach work.',
    link: { label: '@koach.studio ↗', href: 'https://www.instagram.com/koach.studio/' },
  },
  {
    id: 'start',
    chip: 'how did you start?',
    keys: ['start', 'begin', 'began', 'first', 'story', 'how did', 'origin', '6th', 'sixth', 'school', 'grade'],
    answer: 'In school, around 6th grade, I designed YouTube thumbnails for my friends at ₹50 each. Design and editing have been part of my life ever since.',
    secret: true,
  },
  {
    id: 'rates',
    chip: 'what do you charge?',
    keys: ['price', 'rate', 'charge', 'cost', 'fee', 'how much', 'budget', '₹', 'rs'],
    answer: 'A thumbnail is ₹1,000 now (up from ₹50 in school). For brand and content work, message me or Koach with what you need.',
  },
  {
    id: 'hire',
    chip: 'can we work together?',
    keys: ['work together', 'hire', 'collab', 'freelance', 'project', 'commission', 'available', 'opportunit', 'intern'],
    answer: "Yes! DM me on Instagram or email krishviramgamatir@gmail.com. For brand work, Koach is the way. I'm also open to roles where I can join a team and build something meaningful.",
    link: { label: 'email me ↗', href: 'mailto:krishviramgamatir@gmail.com' },
  },
  {
    id: 'tools',
    chip: 'what tools do you use?',
    keys: ['tool', 'software', 'figma', 'photoshop', 'premiere', 'lightroom', 'app', 'ai'],
    answer: 'Figma, Photoshop, Premiere Pro and Lightroom, plus AI tools to make the impossible possible.',
  },
  {
    id: 'thumbs',
    chip: 'your thumbnail work?',
    keys: ['thumbnail', 'youtube', 'rochak', 'sports', 'subscriber', 'views', 'grow'],
    answer: 'I designed the thumbnails for @rochakforsports while the channel grew from 60K to 200K subscribers. My favourites are in the grid below.',
  },
  {
    id: 'study',
    chip: 'what do you study?',
    keys: ['study', 'college', 'degree', 'nmims', 'mpstme', 'b.tech', 'btech', 'data science', 'engineer'],
    answer: "B.Tech + Diploma in Data Science at NMIMS MPSTME, Mumbai (2022–2028). That's alter ego 01; it has its own page.",
    link: { label: 'data side →', href: '/data/' },
  },
  {
    id: 'secret',
    chip: 'any secrets?',
    keys: ['secret', 'hidden', 'easter egg', 'surprise', 'message'],
    answer: 'psst… some sticky notes are hiding things. try moving the yellow one.',
    secret: true,
  },
  {
    id: 'dance',
    chip: 'anything else?',
    keys: ['dance', 'hobby', 'hobbies', 'fun', 'free time', 'else', 'vlog', 'video'],
    answer: 'I love to dance. I used to pursue it seriously before college got busy. And I make vlogs on @figureitoutwithkrish.',
    link: { label: 'youtube ↗', href: 'https://www.youtube.com/@figureitoutwithkrish' },
  },
];

export function answerFor(text) {
  const t = ` ${text.toLowerCase()} `;
  let best = null;
  let bestHits = 0;
  for (const topic of TOPICS) {
    // short keys ("hi", "ai") only as whole words, so "this" isn't a greeting
    const hits = topic.keys.filter((k) => (k.length <= 3 ? new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(t) : t.includes(k))).length;
    if (hits > bestHits) {
      best = topic;
      bestHits = hits;
    }
  }
  return best;
}

export function mountChat(body) {
  body.classList.add('os__body--chat');
  body.innerHTML = `
    <div class="chat__log" role="log" aria-live="polite"></div>
    <div class="chat__chips"></div>
    <form class="chat__form">
      <span class="chat__prompt" aria-hidden="true">&gt;</span>
      <input class="chat__input" type="text" maxlength="120" placeholder="ask me anything…" aria-label="Ask Krish a question" autocomplete="off" spellcheck="false" />
    </form>`;
  const log = body.querySelector('.chat__log');
  const chips = body.querySelector('.chat__chips');
  const form = body.querySelector('.chat__form');
  const input = body.querySelector('.chat__input');
  let typing = 0;

  const add = (who, text, link) => {
    const p = document.createElement('p');
    p.className = `chat__line chat__line--${who}`;
    p.textContent = who === 'me' ? `> ${text}` : text;
    if (link) {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      if (/^https?:/.test(link.href)) Object.assign(a, { target: '_blank', rel: 'noopener' });
      p.append(' ', a);
    }
    log.append(p);
    log.scrollTop = log.scrollHeight;
  };
  const reply = (topic) => {
    clearTimeout(typing);
    const dots = document.createElement('p');
    dots.className = 'chat__line chat__line--krish chat__typing';
    dots.textContent = '…';
    log.append(dots);
    log.scrollTop = log.scrollHeight;
    typing = setTimeout(() => {
      dots.remove();
      if (topic) add('krish', topic.answer, topic.link);
      else add('krish', "Hmm, I don't have a scripted answer for that one. Ask me on Instagram?", { label: '@figureitoutwithkrish ↗', href: IG });
    }, 420);
  };

  TOPICS.filter((t) => !t.secret || t.id === 'start').forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'os__btn chat__chip';
    b.textContent = t.chip;
    b.addEventListener('click', () => {
      add('me', t.chip);
      reply(t);
    });
    chips.append(b);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    add('me', q);
    reply(answerFor(q));
  });

  add('krish', "hi, it's krish (well, a scripted version). ask me something, or tap a question.");
  return { unmount: () => clearTimeout(typing) };
}
