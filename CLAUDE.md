# Portfolio — project guide

Personal portfolio for Krish (B.Tech Data Science) showcasing coding and design work. Target quality: Awwwards-level, with WebGL/3D, smooth scroll, and polished motion. Built iteratively; the visual design is a minimal dark placeholder until inspiration references are shared.

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
index.html              # Single page; one <section> per area (hero, code, design, about, contact)
vite.config.js
public/assets/
  images/               # Static images, served as-is at /assets/images/...
  models/               # 3D models (.glb/.gltf)
  fonts/                # Self-hosted web fonts
src/
  main.js               # Entry: imports CSS, boots the 3D scene, Lenis, and GSAP
  styles/main.css       # Global styles + design tokens
  three/scene.js        # Three.js scene (all WebGL code lives under src/three/)
  sections/             # One JS module per page section
  utils/                # Small shared helpers (e.g. motion.js)
```

## Architecture

- `main.js` is the only entry point. It creates the scene, wires Lenis into `gsap.ticker` (`lenis.raf(time * 1000)`, `lagSmoothing(0)`), and forwards scroll position to the scene via `world.setScroll()`.
- The WebGL canvas (`#webgl`) is fixed, full-screen, and behind the content (`z-index: 0`, `pointer-events: none`). `<main>` sits above it.
- The Three.js scene caps pixel ratio at 2, handles resize, and exposes a small API (`setScroll`, `dispose`). Keep that boundary: the rest of the app talks to the scene only through its returned API.

## Conventions

- **Design tokens as CSS variables.** Colours, fonts, spacing, and timing go in `:root` in `src/styles/main.css`. Do not hard-code values in components; add a token instead.
- **One module per section.** Each section's behaviour lives in `src/sections/<name>.js`, exporting an `init<Name>()` (and a cleanup function if it registers listeners or ScrollTriggers). `main.js` imports and calls them.
- **Three.js code stays in `src/three/`.** No `three` imports outside that folder. Split into further modules there (materials, objects, shaders) as it grows. Dispose geometries, materials, and textures you create.
- **Mobile-first.** Write base styles for small screens; scale up with `min-width` media queries. Use `svh`/`dvh` units with `vh` fallbacks. Test at ~375px wide.
- **Respect `prefers-reduced-motion`.** Check with `prefersReducedMotion()` from `src/utils/motion.js`. When it is set: no Lenis (native scroll), no scroll-reveal or decorative GSAP motion, and the 3D scene renders a still frame. Every new animation must have a reduced-motion path.
- **Content stays visible without JS.** Animate *from* hidden states with `gsap.from`, so content is visible if scripts fail or motion is reduced.
- **Performance.** Keep the render loop lean, avoid layout thrash in scroll handlers, and lazy-load heavy assets (models, large textures).
- Formatting follows `.editorconfig`: 2-space indent, LF, UTF-8.
