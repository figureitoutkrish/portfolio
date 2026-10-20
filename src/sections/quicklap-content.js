// What the quick lap (quicklap.js) says on each alter-ego page: the 60-second version for people
// short on time (recruiters, clients). Copy comes from content/about.md and the projects data.
const GH = 'https://github.com/figureitoutkrish/';
const EMAIL = 'krishviramgamatir@gmail.com';
const CV = '/assets/cv/krish-viramgama-cv.pdf';

export const QUICKLAP = {
  data: {
    kind: 'alter ego 01 · data',
    name: 'krish viramgama',
    line: 'b.tech + diploma in data science · nmims mpstme, mumbai · 2022–2028',
    ask: 'open to data science internships and freelance projects.',
    rowsTitle: 'top 3 projects',
    rows: [
      { title: 'a voice through gunfire', kind: 'deep learning · speech enhancement', what: 'a fine-tuned denoiser pulls a radio voice out of gunfire: snr −1.1 → +8.9 db, and it runs on an iphone.', links: [['code', `${GH}defence-speech-enhancement`]] },
      { title: 'india’s inflation, explained', kind: 'statistics · regression', what: 'hypothesis tests, anova and regression on india’s cpi, kept only where the checks held up.', links: [['code', `${GH}ssdiproject`]] },
      { title: 'unlock', kind: 'full-stack · product', what: 'gated links that turn clicks into an audience: a next.js app and a cloudflare worker at the edge.', links: [['code', `${GH}unlock`], ['live', 'https://unlock-psi-two.vercel.app']] },
    ],
    chipsTitle: 'stack',
    chips: ['python', 'sql', 'pandas', 'pytorch', 'scikit-learn', 'statsmodels', 'opencv', 'javascript', 'typescript', 'next.js'],
    primary: { label: 'download my cv', href: CV, download: true },
    secondary: [
      ['email', `mailto:${EMAIL}`],
      ['github', 'https://github.com/figureitoutkrish'],
      ['linkedin', 'https://www.linkedin.com/in/krish-viramgama-27951927a/'],
    ],
    longWay: 'or take the long way: the garage',
  },
  creative: {
    kind: 'alter ego 02 · creative',
    name: 'krish viramgama',
    line: 'designer and editor · co-founder of koach, a content and creative studio (feb 2025)',
    ask: 'need a pit crew for your brand? talk to koach.',
    rowsTitle: 'proof',
    rows: [
      { title: '60k → 200k subscribers', kind: 'thumbnails · @rochakforsports', what: 'designed the thumbnails while the channel more than tripled, with millions of views.' },
      { title: '3m+ views', kind: 'ads · atovio', what: 'three ads for one campaign, across social platforms.' },
      { title: '20+ brands', kind: 'koach', what: 'strategy, content and design, from the logo to the launch.' },
    ],
    chipsTitle: 'brands',
    chips: ['atovio', 'endura', 'peeyo', 'bafpro', 'bobabob', 'picklx', 'superyou', 'alpino'],
    primary: { label: 'talk to koach ↗', href: 'https://www.instagram.com/koach.studio/', out: true },
    secondary: [
      ['behance', 'https://www.behance.net/theinvrangers'],
      ['email', `mailto:${EMAIL}`],
      ['instagram', 'https://www.instagram.com/figureitoutwithkrish/'],
    ],
    longWay: 'or take the long way: the desk',
  },
};
