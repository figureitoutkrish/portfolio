// The garage's projects (data page). Add a new one by copying an entry; the garage screens, the
// briefing view and the plain list all read from here.
//   slug     url-safe id: the briefing opens at /data/#project/<slug>
//   title    shown big; kind = the one-line category
//   summary  one or two sentences for the card
//   problem / approach / learned   the briefing's sections (leave '' to hide one)
//   stack    tools, in order of importance
//   links    { repo, live } (either can be missing)
//   image    optional, /assets/garage/<slug>.webp (a screenshot)
// Drafted from the GitHub READMEs: Krish, fill in the `learned` lines and fix anything off.
const GH = 'https://github.com/figureitoutkrish/';

export const PROJECTS = [
  {
    slug: 'fruit-ninja-two-ways',
    title: 'fruit ninja, two ways',
    kind: 'computer vision · ai case study',
    year: 2026,
    summary: 'a webcam fruit ninja you play with your hand, built twice: once with claude, once with chatgpt, to compare how each one builds software.',
    problem: 'a college case study on ai in software development: does the assistant change what gets built, and how well it holds up?',
    approach: 'the same brief given to two assistants. each version tracks your hand with mediapipe, turns your index finger into a blade and runs the game in opencv. the claude build ships with unit tests and assets; the chatgpt build is a single file with a self-test mode.',
    learned: '',
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
    learned: '',
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
    learned: '',
    stack: ['python', 'pandas', 'statsmodels', 'scikit-learn', 'scipy', 'streamlit'],
    links: { repo: `${GH}ssdiproject` },
  },
  {
    slug: 'ml-trainer',
    title: 'ml trainer dashboard',
    kind: 'machine learning · tool',
    year: 2026,
    summary: 'upload any csv, pick a target, and train a model in the browser: naive bayes for classes, linear regression for numbers.',
    problem: 'trying a model on a new dataset usually means rewriting the same notebook. this makes it a few clicks.',
    approach: 'streamlit sidebar for the upload and settings; it filters valid targets, splits the data, trains gaussian naive bayes or linear regression, and reports accuracy, a confusion matrix and the classification report (or mse and r²). tested on the breast cancer diagnosis dataset.',
    learned: '',
    stack: ['python', 'scikit-learn', 'pandas', 'matplotlib', 'streamlit'],
    links: { repo: `${GH}naivebayesclassifier_KrishViramgama` },
  },
  {
    slug: 'ipl-auction',
    title: 'ipl auction room',
    kind: 'web app · data',
    year: 2026,
    summary: 'a live ipl-style auction: players from a real dataset, bidders with accounts, every bid stored.',
    problem: '',
    approach: 'a streamlit app over an ipl players csv, with user accounts and bids kept in sqlite, deployed on render.',
    learned: '',
    stack: ['python', 'streamlit', 'sqlite', 'pandas'],
    links: { repo: `${GH}iplauction` },
  },
  {
    slug: 'unlock',
    title: 'unlock',
    kind: 'full-stack · product',
    year: 2026,
    summary: 'links behind a gate: visitors unlock a link by leaving an email or joining a community first.',
    problem: 'creators share links all day and get nothing back. a small gate turns clicks into an audience.',
    approach: 'a next.js app for creating gated links and a cloudflare worker that does the redirects at the edge, with drizzle orm over the database.',
    learned: '',
    stack: ['next.js', 'typescript', 'cloudflare workers', 'drizzle'],
    links: { repo: `${GH}unlock`, live: 'https://unlock-psi-two.vercel.app' },
  },
];
