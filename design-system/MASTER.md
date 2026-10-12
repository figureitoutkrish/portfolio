# Design System — Krish Viramgama Portfolio

Global source of truth. Page files in `design-system/pages/` only record deviations from this.
**Exception: the creative page (`pages/creative.md`) has its own palette (green grid), fonts (Anton / Manrope / JetBrains Mono / Caveat) and casing.**
Tokens live in `:root` in `src/styles/main.css`; this file explains them.

## Source

- **context-con.com** — intro sequence (greeting → polaroids → statement), light paper background, polaroid styling.
- **pamidordesign.co** — home hero: oversized name left, short tagline, outlined tags, large portrait right.
- **bryangarage.dev** — glowing gradient wipe as a transition.
- Krish's own direction: everything lowercase, one blue accent, two "alter egos" (data science · design/Koach).

## Colors

| Role | Token | Value |
|---|---|---|
| Background | `--bg` | `#f7f7f7` |
| Text | `--fg` | `#111111` |
| Muted text | `--muted` | `#6b6b6b` (4.97:1 on bg) |
| Hairlines / tag borders | `--line` | `rgba(17,17,17,.3)` |
| Paper (polaroids, solid surfaces) | `--paper` | `#ffffff` |
| **Accent** | `--accent` | `#1f4fff` (5.41:1 on bg) |

**Dark theme** (`[data-theme="dark"]`): bg `#0b0c10`, text `#ececf1` (16.6:1), muted `#9a9ca6` (7.1:1), line `rgba(236,236,241,.18)`, accent lifted to `#4c74ff` (4.9:1). `--brand #1f4fff` is fixed in both themes (wipe, stat card — white on it is 5.8:1). Other theme tokens: `--photo-bg`, `--marquee` (light `#878787`, 3.2:1), `--fade-a/b/c` (journey hand-off). Never hard-code a colour that should change with the theme.

Blue is the only accent. Use it sparingly: underlines, the "/" in the title, hover states, focus rings, the wipe.

## Typography

- **Landing/home:** Nohemi only (variable, served as the original TTF — licence forbids modifying it). Semi Bold (600) for type, 500 for body copy.
- **Reserved for alter-ego pages:** Inter Semi Bold, Bowlby One SC, Morganite Semi Bold.
- **All text lowercase** (`text-transform: lowercase` on body).
- **Tracking is size-specific** — set `--tracking` on a component, never a raw `letter-spacing`:
  - big name `--tracking-display` −0.035em
  - headings / large text `--tracking-heading` −0.02em
  - body `--tracking` 0
  - small labels & tags `--tracking-small` +0.01em
- **Leading:** 0.92 for the name, ~1.05 headings, 1.45 body.

## Spacing & Grid

- Gutter `--gutter`: 1.25rem mobile, 8vw from 768px.
- Home: single column below 960px (text, then photo); two columns `minmax(0,1fr) minmax(0,1.1fr)` from 960px.
- Touch targets ≥ 44px (menu links 48px).
- Test at 375 / 768 / 1024 / 1440.

## Motion

- Library: GSAP (+ Lenis smooth scroll, paused during the intro).
- **Curves (Emil Kowalski's set)** — registered in `src/utils/ease.js`, mirrored as CSS tokens:
  `ui-out` / `--ease-out` `cubic-bezier(.23,1,.32,1)` for anything entering or exiting;
  `ui-in-out` / `--ease-in-out` `cubic-bezier(.77,0,.175,1)` for on-screen movement;
  `drawer` / `--ease-drawer` `cubic-bezier(.32,.72,0,1)` for big surfaces answering a click (the wipe's cover). **Never ease-in.**
- **Durations:** press 160ms, hover/colour 150–200ms `ease`, dropdowns ~220ms in / 150ms out, scene-setting (intro, page entrances) can be longer. Exits are always faster than entrances.
- **Staggers** 30–80ms. **Hover effects only under `@media (hover: hover) and (pointer: fine)`.**
- **Keyboard-initiated UI (Enter/Space/Escape on the menu) doesn't animate.**
- **Cross-fades between two states use a 2px blur** so they read as one thing changing.
- Only animate `transform`, `opacity` (and `clip-path` for image reveals) — never layout properties like `top`.
- **Feel:** confident and smooth. `power3/power4.out` for entrances, `expo.out` for UI that opens, `power2.in` for UI that closes.
- **Interruptible:** UI tweens start from the current on-screen value (`gsap.to` + `overwrite: true`), so toggling mid-animation reverses smoothly.
- **Press feedback is instant:** `:active { transform: scale(var(--press-scale)) }` (0.96) at 160ms.
- **Spatial consistency:** things appear from where they come from — the menu grows from the burger (`transform-origin: top right`); the wipe travels bottom → top and the home photo opens bottom → top behind it.
- Reveal pattern: masked line rise for display type, staggered word rise for statements, small staggered fades for supporting text.
- Every animation has a reduced-motion path (intro skipped, menu fades only).

## Components

- **Header:** "krish." logo (left) + two-line burger (right) that morphs to an X.
- **Menu:** `.glass.glass--regular`, 22px radius, social links with ↗ icon.
- **Tags:** 1px `--line` border, square corners, 0.875rem, non-interactive.
- **Polaroids:** white paper, padding `0.6rem 0.6rem 2.1rem`, shadow `0 24px 60px rgba(0,0,0,.2)`, slight rotations.
- **Focus ring:** 2px `--accent` outline, 4px offset, on `:focus-visible` only.

## Liquid Glass (functional layer only)

Reusable material: `.glass` in `src/styles/glass.css` + behaviour in `src/utils/liquid-glass.js`. Following Apple's HIG:
- **Only for navigation and controls** (tab bar, menu) — never content, and sparingly.
- **Variants:** base `.glass` is clear (tab bar): ~4% tint, 8px blur, no brightness lift on light pages — measured identical to the page colour, so it's defined only by rim, edge light, refraction and shadow. `.glass--regular` (menu/popovers with text: thicker, 22px blur); `.glass--clear` (+ `.glass--dim`) for controls over photos/video.
- **Layers:** refraction at the rim (SVG displacement map, Chromium only) → blur + saturate + luminosity → thin tint → inner glow + top specular / bottom bounce edges → 1px gradient rim → pointer-following specular shine (desktop).
- **Adaptive tone:** samples what's underneath (image pixels included) and flips to dark glass with white icons; active icon becomes `#8fa9ff` on dark.
- Solid fallbacks for no backdrop-filter, reduced transparency and increased contrast.
- Never stack glass on glass.

## Navigation

- **Tab bar** (`src/sections/tabbar.js`): floating clear-glass pill, bottom centre — code `</>` (data), house (home), pen-tool nib (creative), Lucide-style 1.75px outline icons. Monochrome (per HIG, and the reference): the selected icon cross-fades outline → filled with a 2px blur; a faint translucent capsule sits behind it.
- It sits **above the page wipe** (z-index 40), so it never leaves the screen during page changes; it goes dark-tone while the blue passes behind it.
- **Entrance:** materialises — the pill swells from a narrower droplet (scaleX .82 → 1) while the refraction strength fades 0 → full, then icons resolve from a 4px blur with a 45ms stagger. Exit: 180ms, simpler.
- The capsule runs on springs (`src/utils/spring.js`, Apple's response/damping model): moves on press, can be dragged 1:1 with rubber-banding, is thrown to the projected icon on release, stretches like a droplet with velocity.
- Home: hidden at the top, appears after scrolling 20% of a screen, hides again near the top. Other pages: always visible (HIG: keep the tab bar visible inside a section).
- Tapping the current page's icon scrolls to the top instead of reloading.

## Theme (light / dark)

- `src/utils/theme.js`. The inline head script picks the theme before first paint: saved choice (`localStorage['krish:theme']`), else the device setting. Every page has it.
- **K** (ignored while typing / with modifiers / on repeat) or the menu's "dark mode · k" button switches it: the blue wipe sweeps **up** (0.45s cover), the theme flips under it with transitions disabled (`html.theme-switching`), then the wipe reveals (0.55s). Instant under reduced motion or while the intro / a page wipe is running. K never skips the intro.
- Synced: other open tabs follow live (`storage` event); with no saved choice it follows device changes. `theme:change` event for anything that needs to react (tab bar re-samples its tone).

## Page transitions

- **Every page change uses the blue wipe** (`src/utils/transition.js`), travelling sideways in the direction of the tab bar: to a page on the right (e.g. creative) it sweeps right → left; to a page on the left it sweeps left → right. Cover (`drawer`, 0.55s) → navigate → the new page paints already covered (`html.is-wiping.wipe-x`, set by the inline head script from the stored direction) → reveal (`ui-in-out`, 0.55s). The page content drifts 64px with the wipe on both sides. The intro uses the same wipe vertically (bottom → top, 0.8s halves).
- Internal links go through it automatically; external links (`target="_blank"`) don't. Back/forward-cache restores uncover themselves.
- Arriving on home from another page skips the intro.

## 3D/Depth

- Flat with faked depth (polaroid shadows) plus the liquid-glass functional layer. Three.js is installed but unused.

## Anti-patterns to avoid

- A second accent colour, or the generic purple→pink gradient.
- Uppercase or Title Case text.
- One letter-spacing value for every size.
- Dead controls (buttons that look interactive but do nothing).
- Intros that can't be skipped or replay on every visit.
- Generic hero → three cards → testimonials → footer layouts.
