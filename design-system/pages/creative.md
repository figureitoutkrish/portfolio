# Creative page (`/creative/`, alter ego 02)

Overrides MASTER.md for this page only. The design/creative section of the site: green technical grid, Mac windows, handwritten notes. Editorial portfolio first, Mac nostalgia second, play third. References: Krish's mockup (bento grid, Mac windows, notes) and his Instagram post (lighter green, white grid, Aqua-style pills).

## Global chrome (unchanged, for consistency)
`krish.` header + menu (with the theme button), the liquid-glass tab bar and the page wipe stay exactly as on every page. The menu panel gets ink tokens in light mode (it's light glass over green).

## Colour (tokens on `html.creative`, src/styles/creative.css)
| Role | Light | Dark |
|---|---|---|
| Page green `--c-green` | `#128556` (Insta green #158B58, deepened: white = 4.6:1) | `#014625` (mockup racing green) |
| Grid minor / major | white .07 / .22 | white .05 / .13 |
| Paper (windows, cards) `--c-paper` | `#f5f4ef` | `#ecebe4` |
| Ink / ink-2 on paper | `#20221f` / `#5a5e56` (6.1:1) | same |
| Lime `--c-lime` | `#b6ed68`: CTAs (ink text), handwritten notes. 3.4:1 on green → large text only | same |
| Pale blue `--c-blue` | `#d9e8f8`: selected/pressed only (glossy pill) | same |

White body text sits directly on green (≥4.5:1). Decorative coordinates/ticks use `--c-dim`.

## Grid
Body background: 24px cells (28px from 768px), stronger line every 5th cell. The mini-Mac wallpaper is a deeper green with its own 16/80px grid.

## Type
- Display: **Anton**, uppercase (the name).
- Section headings: **Manrope 800**, Title Case, tracking −0.035em.
- Body: **Manrope** 500, sentence case.
- Labels: **JetBrains Mono** 11px CAPS, tracking .08em: `02  [ SELECTED WORK ]`.
- Notes: **Caveat** 600, lime, slightly rotated, lowercase, ≥1.35rem. Used for memos and asides only, never for essential info (always `aria-hidden` or duplicated).
- Self-hosted via @fontsource (OFL). Nohemi stays home-only. Casing follows the mockup, not the site-wide lowercase rule.

## Components
- `.win`: paper window, 12px radius, `.win__bar` (30px, traffic lights `#ff5f57 #febc2e #28c840`, mono title).
- `.pill`: 44px min height; `--lime` (primary), `--line` (secondary, white outline), `--glossy` (Aqua blue, selected states).
- `.note` (+ `.note__arrow` hand-drawn SVG), `.ph` placeholder (aspect-ratio box, faint grid, mono label: never fake work), `.tick`, `.coord`.
- `.ctool`: sticky section toolbar (paper bar, `krish / creative` path, Work · About · Playground · Contact, `@koach.studio ↗`); marks the current section with a green dot; links scroll via Lenis, sections use `scroll-margin-top: 5rem`.

## Hero
Copy left (label, ANTON name, lime notes "Designer / Editor / Creative" + "& data science student", intro, View Work / About Me). Right: mini Mac with the taped photo window (`IMG_0291.JPG`, `creative-hero.jpg`) leaning on its lower-left, notes "same guy, more ideas." and "double-click to explore", mono list. Phones: photo first, then the Mac (no sticky note).

## Motion
Name lines rise (ui-out, 70ms stagger), the rest fades up after. Same eases/durations as MASTER. Reduced motion: no entrance.
