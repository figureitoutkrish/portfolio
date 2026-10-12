# Page Override — Home (landing)

Inherits: design-system/MASTER.md

## Deviations

- **Nohemi only** — no other typefaces on this page.
- **Intro sequence** (fixed overlay, ~10s, `src/sections/intro.js`): (0.8s pause) "hi, i’m krish" (word by word) → three polaroids drop and stack → stack shrinks to the bottom edge → "lemme introduce you to my alter egos." (blue underline draws in below the text, clear of descenders) → blue gradient wipe bottom → top → home reveal.
- Intro is skippable (any click or key press — no visible button, by design) and, in production, plays once per browser session. It always plays in dev.
- The wipe uses a deliberately richer blue gradient (light blue → `--accent` → `#0a1a6b`) than anywhere else on the site.
- **Hero:** name "Krish Viramgama" keeps its capitals (`text-transform: none`), Nohemi 500 (lighter than other headings), line-height 0.84 so the two lines sit tight; tagline "data, design & everything in between. i take the curious seriously." No title line.
- **Cursor trail** over the portrait (pamidordesign.co-inspired, `src/sections/trail.js`): every 90px of pointer travel the next of Krish's 8 navy illustrations (`public/assets/trail/*.webp`, 110px wide) drops at the pointer with a random tilt, pops in (350ms) and fades (300ms). Pointer devices only.
- **About** (pamidordesign.co-inspired, `src/sections/about.js`): the intro (a full screen tall) **pins** for ~1.6 screens of scrolling while the paragraph reveals word by word — each word fades up from .16 in the accent blue, then settles to ink, so a blue wave runs through it — then rests briefly and releases. Paragraph is sentence case (Krish's own copy), with @figureitoutwithkrish linked. Tilted (-6°) childhood photo (`about-krish.jpg`) drifts while pinned; divider; blue highlights card cycling stats with a blur cross-fade; "(clients & collaborations)" marquee of client names in two rows moving opposite ways (pauses on hover, static under reduced motion).
- **Dividers:** `<hr class="divider">` (1px `--line`, inside the gutters) between page sections.
- **Journey** (bryangarage.dev-inspired, `src/sections/journey.js`), after About on the blue "techy" world (`--deep #050b24`, radial blue glows, the wipe's streak texture), with static gradient fades from/to the light page:
  - one pinned stage; durations are in px of scroll. **Boot:** `krish@portfolio ~ % showcase --timeline` types out, then a 24-cell bar fills ("loading timeline… N%" → "timeline ready ✓") while a canvas pixel field glows up from the bottom — scrubbed, so scrolling back un-fills it. **Reveal:** terminal fades, timeline rises in, bars stagger. **Travel:** vertical scroll moves the track sideways; a big year readout tracks the centre.
  - timeline: 2018–2028 axis, year + quarter gridlines, glowing "now" line (from today's date), lanes of glass bars (current ones blue and glowing, running past now), hatched bars for long-running threads (thumbnails, degree, school). Entries live in `index.html` (`--start`/`--span` in years since 2018, `--lane`).
  - cards: hover (desktop), tap (touch) or keyboard focus (scrolls the bar into view) opens a blue glass card above/below the bar: image area (`data-img` on the item, else a monogram), org, dates, roles, story.
  - Reduced motion / no JS: no pin or terminal — a plain sideways-scrolling strip.
- The intro jumps to the top and flags `html.is-intro`; the tab bar never shows during it.

