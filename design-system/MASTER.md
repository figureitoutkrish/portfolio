# Design System — Krish Viramgama Portfolio

Global source of truth. Page files in `design-system/pages/` only record deviations from this.
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
- Only animate `transform`, `opacity` (and `clip-path` for image reveals) — never layout properties like `top`.
- **Feel:** confident and smooth. `power3/power4.out` for entrances, `expo.out` for UI that opens, `power2.in` for UI that closes.
- **Interruptible:** UI tweens start from the current on-screen value (`gsap.to` + `overwrite: true`), so toggling mid-animation reverses smoothly.
- **Press feedback is instant:** `:active { transform: scale(.94) }` at 100ms.
- **Spatial consistency:** things appear from where they come from — the menu grows from the burger (`transform-origin: top right`); the wipe travels bottom → top and the home photo opens bottom → top behind it.
- Reveal pattern: masked line rise for display type, staggered word rise for statements, small staggered fades for supporting text.
- Every animation has a reduced-motion path (intro skipped, menu fades only).

## Components

- **Header:** "krish." logo (left) + two-line burger (right) that morphs to an X.
- **Menu:** light translucent material (`blur(20px) saturate(180%)`, white 72%), soft two-layer shadow, social links with ↗ icon. Solid under `prefers-reduced-transparency` / `prefers-contrast`.
- **Tags:** 1px `--line` border, square corners, 0.875rem, non-interactive.
- **Polaroids:** white paper, padding `0.6rem 0.6rem 2.1rem`, shadow `0 24px 60px rgba(0,0,0,.2)`, slight rotations.
- **Focus ring:** 2px `--accent` outline, 4px offset, on `:focus-visible` only.

## 3D/Depth

- Flat with faked depth (polaroid shadows, translucent menu). Three.js is installed but unused on the landing page.

## Anti-patterns to avoid

- A second accent colour, or the generic purple→pink gradient.
- Uppercase or Title Case text.
- One letter-spacing value for every size.
- Dead controls (buttons that look interactive but do nothing).
- Intros that can't be skipped or replay on every visit.
- Generic hero → three cards → testimonials → footer layouts.
