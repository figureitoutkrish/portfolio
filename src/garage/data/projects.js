// The garage's projects (data page). Add a new one by copying an entry; the garage screens, the
// briefing view and the plain list all read from here.
//   slug     url-safe id: the briefing opens at /data/#project/<slug>
//   title    shown big; kind = the one-line category
//   summary  one or two sentences for the card
//   problem / approach / learned   the briefing's sections (leave '' to hide one)
//   stack    tools, in order of importance
//   links    { repo, live } (either can be missing)
//   image    optional, /assets/garage/<slug>.webp (a screenshot)
//   team     optional, a credit line for team builds (shown in the briefing)
//   check    optional, radio-check clips (radio-check.js): { id, says, raw, model } where id names
//            public/assets/audio/radio-check/<id>-raw.m4a + <id>-model.m4a and raw / model are the
//            clip's SNR in dB before and after; checkNote credits the audio
// Drafted from the GitHub READMEs; the `learned` lines are drafts in Krish's voice: fix anything off.
const GH = 'https://github.com/figureitoutkrish/';

export const PROJECTS = [
  {
    slug: 'voice-through-gunfire',
    title: 'a voice through gunfire',
    kind: 'deep learning · speech enhancement',
    year: 2026,
    team: 'team gradient descent · smart india hackathon 2026 (sih26052)',
    summary: 'a radio voice recorded next to gunfire, pulled back out by a fine-tuned neural network that runs on an iphone. open it, then turn the dial and hear it.',
    problem: 'defence radios pick up speech and gunfire as one waveform. classical noise suppression assumes the noise is steady; a gunshot is the opposite, so it fails exactly where it matters. can a model rebuild the voice instead?',
    approach: "fine-tuned facebook's denoiser (dns48: 18.9m parameters, causal, so it could run live) on librispeech voices mixed with real gunfire, engine and ambient noise from −5 to 15 db, split so no test voice is ever heard in training. five versions, each fixing the last one's failure. on the 97 gunfire test clips the snr goes from −1.1 to +8.9 db on average, where hand-built spectral subtraction barely moves. then pytorch → onnx → core ml int8 (72 → 18 mb): about 54 ms per 4 s of audio on an iphone. it misses the brief's absolute targets (15 db snr), and the readme says so.",
    learned: 'averages hide failures: every version only got better once i went looking for the clip it did worst on.',
    stack: ['python', 'pytorch', 'denoiser (dns48)', 'onnx', 'core ml', 'swiftui', 'streamlit'],
    links: { repo: `${GH}defence-speech-enhancement` }, // full history kept; the README credits the team and links Arnav's original
    check: [
      { id: 'clean-break', says: "it's got to be a clean break, hilda.", raw: -3.8, model: 15.0 },
      { id: 'snake', says: 'a snake of his size in fighting trim would be more than any boy could handle.', raw: 1.8, model: 17.9 },
      { id: 'pages', says: 'i cannot hope that these pages will be altogether free from anachronisms and errors.', raw: 2.2, model: 16.1 },
    ],
    checkNote: 'unseen voices · librispeech + kabealo & wyatt, cc by 4.0',
  },
  {
    slug: 'fruit-ninja-two-ways',
    title: 'fruit ninja, two ways',
    kind: 'computer vision · ai case study',
    year: 2026,
    summary: 'a webcam fruit ninja you play with your hand, built twice: once with claude, once with chatgpt, to compare how each one builds software.',
    problem: 'a college case study on ai in software development: does the assistant change what gets built, and how well it holds up?',
    approach: 'the same brief given to two assistants. each version tracks your hand with mediapipe, turns your index finger into a blade and runs the game in opencv. the claude build ships with unit tests and assets; the chatgpt build is a single file with a self-test mode.',
    learned: 'the same brief came back as two very different programs, so the brief is the part worth getting right.',
    stack: ['python', 'opencv', 'mediapipe'],
    links: { repo: `${GH}fruit-ninja-claude-vs-chatgpt` },
  },
  {
    slug: 'perfect-circle',
    title: 'perfect circle, in the air',
    kind: 'computer vision · game',
    year: 2026,
    summary: 'draw a circle in the air with one finger and get scored on how perfect it is. the same game lives on the creative page, drawn with a mouse.',
    problem: 'can a webcam judge a shape you draw in thin air?',
    approach: 'mediapipe tracks the index finger; raising it starts the stroke. the path is scored on shape (how far it drifts from a true circle) and on centring around the dot, then saved to a local leaderboard. pygame draws the game.',
    learned: '"perfect" isn\'t a feeling, it\'s a number you have to define, and scoring a wobbly circle was harder than tracking the finger.',
    stack: ['python', 'mediapipe', 'opencv', 'pygame'],
    links: { repo: `${GH}PerfectCircleAppwithPYTHON` },
  },
  {
    slug: 'india-cpi',
    title: "india's inflation, explained",
    kind: 'statistics · regression',
    year: 2026,
    summary: "a streamlit study of india's consumer price index: hypothesis tests, anova, and regression models that hold up to checks.",
    problem: 'what moves consumer prices in india, and which of those effects are real rather than noise?',
    approach: 'cleaned cpi data, then t-tests and anova with tukey post-hoc comparisons, ols regression with vif checks for multicollinearity, and ridge and lasso tuned by k-fold cross-validation, all in one interactive app.',
    learned: 'a small p-value isn\'t the finish line: the checks decided which results i\'d actually stand behind.',
    stack: ['python', 'pandas', 'statsmodels', 'scikit-learn', 'scipy', 'streamlit'],
    links: { repo: `${GH}ssdiproject` },
  },
  {
    slug: 'unlock',
    title: 'unlock',
    kind: 'full-stack · product',
    year: 2026,
    summary: 'links behind a gate: visitors unlock a link by leaving an email or joining a community first.',
    problem: 'creators share links all day and get nothing back. a small gate turns clicks into an audience.',
    approach: 'a next.js app for creating gated links and a cloudflare worker that does the redirects at the edge, with drizzle orm over the database.',
    learned: 'the unglamorous bits, like redirects at the edge, the database and the deploy, are what turn an idea into something people can click.',
    stack: ['next.js', 'typescript', 'cloudflare workers', 'drizzle'],
    links: { repo: `${GH}unlock`, live: 'https://unlock-psi-two.vercel.app' },
  },
];
