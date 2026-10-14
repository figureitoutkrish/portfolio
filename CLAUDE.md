# Portfolio — project guide

Personal portfolio for Krish Viramgama (B.Tech + Diploma, Data Science), titled "Data Scientist / Creative". Concept: two **alter egos** visitors can explore — data science / engineering, and design / social media / Koach (Krish's creative agency). Target quality: Awwwards-level, polished motion. Built page by page from Krish's references (Figma board + sites); `content/about.md` holds all personal copy.

## Design system

**Read `design-system/MASTER.md` before any visual work**, then `design-system/pages/<page>.md` if it exists (page rules override Master). Keep both up to date when the design changes. Essentials:

- Light theme, blue accent `#1f4fff`, all text lowercase, Nohemi on the landing page.
- Tracking is size-specific: set `--tracking` per component (display −0.035em, heading −0.02em, body 0, small +0.01em).
- Animate only transform/opacity/clip-path; UI tweens must be interruptible; instant `:active` press feedback.
- Original photos go in `content/` (git-ignored); optimised JPEG copies live in `public/assets/images/`.
- Every page's `<head>` has an inline guard (`body{visibility:hidden}`, undone by main.css) so the dev server never flashes unstyled HTML; give inline SVGs explicit `width`/`height`.

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
data/index.html         # Data alter-ego page: drive into the pit box, then the steering wheel is the page (design-system/pages/data.md)
creative/index.html     # Creative alter-ego page: green grid, Mac windows, bento work (design-system/pages/creative.md)
design-system/          # MASTER.md (global design rules) + pages/<page>.md overrides
content/about.md        # Personal copy, links and timeline (source for About content)
vite.config.js
api/                    # Vercel functions: scores.js (leaderboard), notes.js (visitor sticky notes); Upstash Redis. Setup: docs-backend.md
public/assets/
  images/               # Static images, served as-is at /assets/images/...
  work/<slug>/          # Creative-page project images (from Behance; originals in content/behance/)
  models/               # 3D models (.glb/.gltf)
  fonts/                # Self-hosted web fonts
src/
  main.js               # Home entry (intro, home reveal)
  data.js               # Entry for the data page (+ src/garage/ modules, styles/data.css)
  garage/               # Data page logic, no three.js: drive.js, vehicle.js, telemetry.js, wheel.js + modes/, data/projects.js (add projects here)
  creative.js           # Entry for the creative page (+ src/creative/ modules, styles/creative.css + creative-mac.css)
  creative/             # Creative page: mac/ (os.js, cabinet.js, apps/), desk.js, work.js, project-window.js, data/projects.js
  shared.js             # Every page: Lenis, menu, tab bar, page transitions, ⌘K palette (sections/palette.js), record player
  audio/                # sfx.js (site-wide sound effects, a theme per page), player.js + records.js (header record player)
  assets/music/<record>/ # the record player's tracks (picked up automatically; only music Krish has rights to)
  styles/main.css       # Global styles + design tokens
  styles/glass.css      # Liquid glass material (.glass, variants)
  three/scene.js        # Three.js scene (currently unused; all WebGL code lives under src/three/)
  three/garage/         # The data page's 3D: cockpit (car.js, gloves.js, driver.js, lcd.js), pit lane (pitlane.js)
  assets/local/         # git-ignored, never published: unlicensed models used only on Krish's Mac (the W11)
scripts/fbx-to-glb.mjs  # converts an FBX car to a geometry-only GLB
  sections/             # One JS module per page section (home, intro, menu, tabbar, trail, about, journey)
  utils/                # motion.js, spring.js, liquid-glass.js, transition.js (page wipe)
```

## Architecture

- Multi-page Vite build (inputs in `vite.config.js`). Every page loads `shared.js`; each new page needs the inline head script (JS flag + `is-wiping`), the header, the tab bar and the `.wipe` element. Internal links automatically go through the wipe.
- `shared.js` wires Lenis into `gsap.ticker` (`lenis.raf(time * 1000)`, `lagSmoothing(0)`), waits for fonts (max 1.5s), then calls each section's `init`.
- The intro (`src/sections/intro.js`) is a fixed overlay above home, driven by one GSAP timeline: greeting → polaroids stack → headline → blue gradient wipe (bottom → top, bryangarage.dev-inspired) → `home.reveal()`. The intro is hidden while the wipe fully covers the screen (its midpoint). Any click or key press skips to the end; in production it plays once per session (sessionStorage). Without JS or with reduced motion, CSS hides the intro and home shows directly.
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
