# Page Override — Home (landing)

Inherits: design-system/MASTER.md

## Deviations

- **Nohemi only** — no other typefaces on this page.
- **Intro sequence** (fixed overlay, ~10s, `src/sections/intro.js`): (0.8s pause) "hi, i’m krish" → three polaroids drop and stack → stack shrinks to the bottom edge → "lemme introduce you to my alter egos." (blue underline draws in below the text, clear of descenders) → blue gradient wipe bottom → top → home reveal.
- Intro is skippable (visible "skip intro" button, any click or key) and, in production, plays once per browser session. It always plays in dev.
- The wipe uses a deliberately richer blue gradient (light blue → `--accent` → `#0a1a6b`) than anywhere else on the site.
