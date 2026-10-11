# Page Override — Home (landing)

Inherits: design-system/MASTER.md

## Deviations

- **Nohemi only** — no other typefaces on this page.
- **Intro sequence** (fixed overlay, ~10s, `src/sections/intro.js`): (0.8s pause) "hi, i’m krish" (word by word) → three polaroids drop and stack → stack shrinks to the bottom edge → "lemme introduce you to my alter egos." (blue underline draws in below the text, clear of descenders) → blue gradient wipe bottom → top → home reveal.
- Intro is skippable (any click or key press — no visible button, by design) and, in production, plays once per browser session. It always plays in dev.
- The wipe uses a deliberately richer blue gradient (light blue → `--accent` → `#0a1a6b`) than anywhere else on the site.
- **Hero:** name in Nohemi 500 (lighter than other headings), line-height 0.84 so the two lines sit tight; tagline "data, design & everything in between. i take the curious seriously." No title line.
- **Cursor trail** over the portrait (pamidordesign.co-inspired, `src/sections/trail.js`): every 90px of pointer travel the next blue drawing (`public/assets/trail/*.svg` — laptop, camera, chart, dancer, pen tool, play button) drops at the pointer with a random tilt, pops in (350ms) and fades (300ms). Pointer devices only.
- **About** (pamidordesign.co-inspired, `src/sections/about.js`): large intro paragraph whose words brighten (opacity .16 → 1) as it scrolls through; tilted (-6°) candid photo drifting with parallax; divider; blue highlights card cycling stats with a blur cross-fade; "(clients & collaborations)" marquee of client names in two rows moving opposite ways (pauses on hover, static under reduced motion).

