# portfolio

Personal portfolio: coding and design work.

**Stack:** Vite · HTML/CSS/JS · Three.js · GSAP + ScrollTrigger · Lenis

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
npm run preview  # preview the production build
```

## Structure

```
public/assets/{images,models,fonts}   static assets
src/main.js                           entry: scene + Lenis + GSAP
src/styles/main.css                   global styles and design tokens
src/three/                            all Three.js / WebGL code
src/sections/                         one module per page section
src/utils/                            shared helpers
```

See [CLAUDE.md](CLAUDE.md) for conventions.
