# Creative page (`/creative/`, alter ego 02)

Overrides MASTER.md for this page only. The design/creative section of the site: green technical grid, Mac windows, handwritten notes. Editorial portfolio first, Mac nostalgia second, play third. References: Krish's mockup (bento grid, Mac windows, notes) and his Instagram post (lighter green, white grid, Aqua-style pills).

## Scope
Three parts only: the hero Mac, Work, and a small Koach block. Nothing that home already says (name, bio, About, stats, clients, timeline) is repeated here. The thumbnail origin story (₹50 for friends in 6th grade → ₹1,000 today) lives only in hidden details: the flip note, the floppy label, the chat bot.

## Global chrome
The `krish.` menu, the liquid-glass tab bar and the page wipe stay as on every page. **The header on this page only** gets three working traffic lights before `krish.`: red = "Quit Creative?" alert → home; yellow = skip to Work; green = Mac full screen. No extra toolbar. The menu panel gets ink tokens in light mode (light glass over green).

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

## The Mac (hero centrepiece)
A platinum-beige vintage Macintosh, built in CSS. The front face sits at z = 0, so it's never distorted. The top and right side are real 3D planes that recede, seen through `perspective` from up and to the right. Everything scales off `--mw` (Mac width).

- **Parts:** recessed bezel, CRT with scanlines, a tube vignette and glare. The chin has a rainbow "K" badge, a "Krish Classic" model plate, a floppy slot with an eject button, an LED, a power button and a brightness knob. A foot and a desk shadow sit below.
- **Screen:** a 1-bit classic Mac OS (`.os`) in Pixelify Sans, with the terminal and chat in VT323. Menu bar (✦ File Edit Special Help + clock), dithered desktop, pixel icons (Work, Circle, Racer, Talk to me, Scores), and a striped-title classic window. The screen is a size container, so all of its sizes are in `cqw`.
- **Around it:** stickers (Koach → Instagram, YouTube, Behance, star, smiley), sticky notes (canary, rose that flips with the origin story, tang), two floppies (CIRCLE.DSK, RACER.DSK), physical gamepad keys, and the taped photo window.
- **Phones:** only the rose note, the photo smaller, keys left and disks right. The hero clips horizontal overflow.

## Components
- `.win`: paper window, 12px radius, `.win__bar` (30px, traffic lights `#ff5f57 #febc2e #28c840`, mono title).
- `.pill`: 44px min height; `--lime` (primary), `--line` (secondary, white outline), `--glossy` (Aqua blue, selected states).
- `.note` (+ `.note__arrow` hand-drawn SVG), `.ph` placeholder (aspect-ratio box, faint grid, mono label: never fake work), `.tick`, `.coord`.

## Hero
"alter ego 02:" (Caveat) over "THE CREATIVE." (Anton), plus a one-line lede. The desk with the Mac is on the right from 1100px, and below the headline on smaller screens.


## Interactions (src/creative/)
- **Mac OS** (`mac/os.js`): one classic window at a time. Desktop icons select on click and open on double-click, Enter, or a single tap on touch. Menus (File / Edit / Special / Help) have real items and links. Classic alert and prompt dialogs. Power off collapses the tube to a line; power on plays a short happy-Mac boot. The idle app is **Work.slideshow**, which cycles project covers; "Open" goes to the project's window.
- **Games need their floppy.** Drag CIRCLE.DSK or RACER.DSK into the slot (or click / Enter a disk): it lines up, slides in, the LED blinks and the game opens. Opening a game icon without its disk shows an alert and nudges the disk. **Game mode** holds the page still (Lenis stopped, arrows / space / page keys captured with preventDefault) and scrolls the Mac to the centre first. **Eject**, **power**, **Esc** or the close box end it; the disk springs back to the desk.
- **Perfect Circle**: low-res pixel canvas (240×168, letterbox-aware pointer mapping), scored around the dot (`circle-score.js`, shared with the server). **Racer**: 200×140 1-bit top-down road; autopilot demo until you press ↑ / A; speed climbs; score = metres.
- **High Scores** (top 10 per game) and **Talk to Krish** (scripted, keywords from about.md; "6th grade" tells the origin story).
- **Gamepad keys** under the Mac drive the games; real arrow keys press them visually too.
- **Desk** (`desk.js`, `drag.js`): stickers and house notes drag (tap opens a sticker's link, a drag never does; positions kept for the session); the rose note flips. **Visitors' notes**: "+ leave a note" opens a pad (5 paper colours, 3 pens: pen / marker / label maker) and the note is stuck on the Mac for everyone (`api/notes.js`), or for this browser only until the backend is connected.
- **Header lights** (`header-lights.js`): red opens the "Quit Creative?" alert (glossy pills), which goes home through the wipe; yellow glides to Work; green makes the Mac full screen (Esc or the exit pill to leave).
- **Work** (`work.js`, `data/projects.js`): 12 projects (11 from Behance + an Atovio placeholder). Bento on 12 columns with sizes feature / tall / wide / square / small and fixed row heights from 640px; filters with counts, animated with GSAP Flip. **Project window** (`project-window.js`): grows from the card and shrinks back, `#project/<slug>`, ← → step, Esc / backdrop / red dot close, focus trapped and restored.
- **Backend**: see `docs-backend.md`.


## Extras
- **⌘K palette** (`src/sections/palette.js`, site-wide; also "jump to… ⌘K" in the menu). It opens instantly from the keyboard and animates only from a click. Base commands: pages, theme, email, socials. This page adds projects, Play Racer / Circle (scrolls to the Mac and inserts the disk), High Scores, Talk to Krish, Sound and Mac full screen. Styled as a paper Mac window here, plain elsewhere.
- **Link previews** (`peek.js`): on hover or keyboard focus over outside links (Koach, Instagram, YouTube, LinkedIn, Behance, project pages, email), a mini Mac window appears above the link. The first waits 320ms, the next ones open instantly; it grows from the link.
- **Pixel cursors** (mouse / trackpad only): classic arrow, pointing hand on clickables, open hand on draggables (stickers, notes, disks, knob), fist while holding. Defined as `--cur-*` tokens in creative-mac.css.
- **Rev, the mascot** (`mascot.js`): an original chibi red pixel race car (headlight eye, "K" door). Not a copy of any film character. It sits on the Mac's top, blinks, drives back and forth every ~11s and honks when tapped. Its hint bubble cycles tips, including one about the secret disk. It reacts to disks, games and power (sleeps when the Mac is off).
- **Secret disk**: MESSAGE.MOV is hidden under the welcome note (under the story note on phones). It plays `public/assets/secret/message.mp4` (+ optional `message.jpg` poster) and shows "coming soon" until the file exists.
- **Sound** (`sound.js`): Web Audio, synthesised, **off by default**. Toggle with the speaker in the Mac's menu bar or ⌘K. Sounds play only on causal moments: disk in/out, power, boot, alerts, keys, game start / crash / score, the mascot's horn.
- **Hover cycling**: a work card cycles through its own project's images on hover (`hover: [...]` in projects.js if set, otherwise the gallery).
- **Blurry placeholders**: every work image has a 20px blurred preview (`data/placeholders.json`) that shows until the real one fades in. After adding images, regenerate the placeholders (the 20px WebP data URIs keyed `slug/NN`).
- **Share previews**: `public/og/{home,data,creative}.jpg` (1200×630) plus og/twitter tags on every page. `__SITE_URL__` is filled at build from `SITE_URL` or Vercel's production URL.

## Motion
Name lines rise (ui-out, 70ms stagger), the rest fades up after. Same eases/durations as MASTER. Reduced motion: no entrance.
