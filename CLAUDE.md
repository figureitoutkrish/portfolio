# Portfolio — project guide

Personal portfolio for Krish Viramgama (B.Tech + Diploma, Data Science), titled "Data Scientist / Creative". Concept: two **alter egos** visitors can explore — data science / engineering, and design / social media / Koach (Krish's creative agency). Target quality: Awwwards-level, polished motion. Built page by page from Krish's references (Figma board + sites); `content/about.md` holds all personal copy.

## Visual direction

- Light theme (context-con.com style): `--bg #f7f7f7`, `--fg #111`. **Accent: blue `--accent #1f4fff`.**
- **All text lowercase.** The landing page uses only **Nohemi** (Semi Bold), with tight tracking: `--tracking: -0.01em`, `--tracking-display: -0.035em` for the big name (applied per element so it scales). Inter, Bowlby One SC and Morganite are reserved for the alter-ego pages.
- Nohemi's licence forbids modifying the font files: serve the original TTF, don't convert/subset it.
- Original photos go in `content/` (git-ignored); optimised JPEG copies live in `public/assets/images/`.

## Stack

- **Vite** (vanilla JS, no framework): dev server and bundler
- **HTML / CSS / JavaScript**: ES modules only (`"type": "module"`)
- **Three.js**: WebGL / 3D
- **GSAP + ScrollTrigger**: animation and scroll-driven motion
- **Lenis**: smooth scrolling, driven by GSAP's ticker

## Commands

```bash
npm install
npm run dev       # dev server (opens browser)
npm run build     # production build -> dist/
npm run preview   # serve the production build
```

## Folder structure

```
index.html              # Home (pamidordesign.co-style hero) + intro overlay + gradient wipe
content/about.md        # Personal copy, links and timeline (source for About content)
vite.config.js
public/assets/
  images/               # Static images, served as-is at /assets/images/...
  models/               # 3D models (.glb/.gltf)
  fonts/                # Self-hosted web fonts
src/
  main.js               # Entry: imports CSS, starts Lenis, waits for fonts, inits sections
  styles/main.css       # Global styles + design tokens
  three/scene.js        # Three.js scene (currently unused; all WebGL code lives under src/three/)
  sections/             # One JS module per page section (home.js, intro.js)
  utils/                # Small shared helpers (e.g. motion.js)
```

## Architecture

- `main.js` is the only entry point. It wires Lenis into `gsap.ticker` (`lenis.raf(time * 1000)`, `lagSmoothing(0)`), waits for fonts (max 1.5s), then calls each section's `init`.
- The intro (`src/sections/intro.js`) is a fixed overlay above home, driven by one GSAP timeline: greeting → polaroids stack → headline → blue gradient wipe (bottom → top, bryangarage.dev-inspired) → `home.reveal()`. The intro is hidden while the wipe fully covers the screen (its midpoint). Any click or key press skips to the end. Without JS or with reduced motion, CSS hides the intro and home shows directly.
- The Three.js scene isn't mounted on the landing page. If it's used again: fixed full-screen `#webgl` canvas behind `<main>`, pixel ratio capped at 2, and the rest of the app talks to it only through its returned API (`setScroll`, `dispose`).

## Conventions

- **Design tokens as CSS variables.** Colours, fonts, spacing, and timing go in `:root` in `src/styles/main.css`. Do not hard-code values in components; add a token instead.
- **One module per section.** Each section's behaviour lives in `src/sections/<name>.js`, exporting an `init<Name>()` (and a cleanup function if it registers listeners or ScrollTriggers). `main.js` imports and calls them.
- **Three.js code stays in `src/three/`.** No `three` imports outside that folder. Split into further modules there (materials, objects, shaders) as it grows. Dispose geometries, materials, and textures you create.
- **Mobile-first.** Write base styles for small screens; scale up with `min-width` media queries. Use `svh`/`dvh` units with `vh` fallbacks. Test at ~375px wide.
- **Respect `prefers-reduced-motion`.** Check with `prefersReducedMotion()` from `src/utils/motion.js`. When it is set: no Lenis (native scroll), no scroll-reveal or decorative GSAP motion, and the 3D scene renders a still frame. Every new animation must have a reduced-motion path.
- **Content stays visible without JS.** Animate *from* hidden states with `gsap.from`, so content is visible if scripts fail or motion is reduced.
- **Performance.** Keep the render loop lean, avoid layout thrash in scroll handlers, and lazy-load heavy assets (models, large textures).
- Formatting follows `.editorconfig`: 2-space indent, LF, UTF-8.
