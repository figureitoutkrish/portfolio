# Creative page (`/creative/`, alter ego 02)

Overrides MASTER.md for this page only. The design/creative section of the site: green technical grid, Mac windows, handwritten notes. Editorial portfolio first, Mac nostalgia second, play third. References: Krish's mockup (bento grid, Mac windows, notes) and his Instagram post (lighter green, white grid, Aqua-style pills).

## Scope
Parts: the hero Mac, Work, Content (Instagram), and the Koach block. Nothing that home already says (name, bio, About, stats, clients, timeline) is repeated here. The thumbnail origin story (₹50 for friends in 6th grade → ₹1,000 today) lives only in hidden details: the flip note, the floppy label, the chat bot.

## Global chrome
**Light only:** `<html data-theme-lock="light">`. K, the menu's theme button and the ⌘K theme command are off here, and the saved theme is untouched for other pages. The `krish.` menu, the liquid-glass tab bar and the page wipe stay as on every page. **The header on this page only** gets three working traffic lights before `krish.`: red = "Quit Creative?" alert → home; yellow = skip to Work; green = Mac full screen. No extra toolbar. The menu panel gets ink tokens in light mode (light glass over green).

## Colour (tokens on `html.creative`, src/styles/creative.css)
| Role | Light (the only mode) | Dark |
|---|---|---|
| Page green `--c-green` | `#0b6440` (deeper than the Insta green, which read as faded; white = 7.2:1, lime = 5.3:1) | n/a |
| Grid minor / major | white .08 / .24 | n/a |
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
- **Perfect Circle**: low-res pixel canvas (240×168, letterbox-aware pointer mapping), scored around the dot (`circle-score.js`, shared with the server). **Racer**: 200×140 1-bit top-down road; autopilot demo until you press ↑ / A. Built to be hard: the road speeds up every 30s lap (to 280), traffic comes in two-car walls with one gap, slow trucks rush at you, some cars change lanes (amber indicator blinks first), cones sit still from lap 1's end. Score = metres + bonuses: a close shave past a car +10, an energy can +25 and ~2.6s airborne over traffic (a generic silver/blue can, no brand: Krish's Red Bull habit). The server's plausibility cap (`RACER_MAX_MPS` in `api/scores.js`) allows for the bonuses.
- **High Scores** (top 10 per game) and **Talk to Krish** (scripted, keywords from about.md; "6th grade" tells the origin story).
- **Gamepad keys** under the Mac drive the games; real arrow keys press them visually too.
- **Desk** (`desk.js`, `drag.js`): stickers and house notes drag (tap opens a sticker's link, a drag never does; positions kept for the session); the rose note flips. **Visitors' notes**: "+ leave a note" opens a pad (5 paper colours, 3 pens: pen / marker / label maker) and the note is stuck on the Mac for everyone (`api/notes.js`), or for this browser only until the backend is connected.
- **Phones in full screen:** the Mac grows to 112vw (cabinet sides bleed off) so the screen nearly fills the width; the spare disk hides while a game runs so it never covers the keys. On touch, the screen's tiny controls (menus, close box, buttons, speaker) get invisible finger-sized hit areas.
- **Header lights** (`header-lights.js`): red opens the "Quit Creative?" alert (glossy pills), which goes home through the wipe; yellow glides to Work; green makes the Mac full screen (Esc or the exit pill to leave).
- **Work** (`work.js`, `data/projects.js`): four projects for now: YouTube Thumbnails (feature), Peeyo (tall), Endura and Gourmet Greens (half). **Three card shapes only:** feature 16:10 (cover 2400×1500), tall 4:5 (1600×2000), half 16:9 (2400×1350).
  - **Layout:** phones show one column at each card's own ratio; tablets show the feature on top with the tall card beside the two halves; desktop shows feature (8) + tall (4), then half (6) + half (6).
  - **Project images** come from Krish's folders in `content/<project>/` (git-ignored) as well as Behance: Peeyo has his 8 feed posts (`p1…p8`, 1200×1500) before the Behance boards. A project can have a `doc`: Rochak's full `thumbnailportfolio.pdf` is shown as a scrollable document (one long page rendered to 1400px, cut into `sheet-1…4.webp` for loading) with a file bar and a scroll-progress line. In the gallery, posts and squares sit three to a row (two on phones); wide boards and tall sheets span the row.
  - **Filters:** a classic Mac segmented control on a paper strip (Pixelify, ink borders, the selected one inverted), animated with GSAP Flip. **Project window** (`project-window.js`): grows from the card and shrinks back, `#project/<slug>`, ← → step, Esc / backdrop / red dot close, focus trapped and restored.
- **Content** (`#content`, `src/creative/content.js`, `data/reels.js`, `styles/creative-content.css`): @figureitoutwithkrish as race telemetry. Numbers come only from Krish's Instagram insights exports (Edits, Oct 2026; originals in `content/instagram/`). A dark dash readout (14.9M+ views across the top 13 reels in 2 years, 8M reached by one reel, 1.39M+ likes, 249K+ shares, 320K views in the last 90 days) whose numbers count up once in view; P1's feature (the 13.6M "wyd after exam" reel in a tilted phone, full stats, why it worked); a timing-tower **standings** board of the top reels (position, theme = team colour, log-scale views bar, likes/shares; top 10 with "show all 13"); four "what works" cards. Rows link to each reel once its URL is in `reels.js` (until then, the reels tab). Covers come from the Edits PDFs (play icon and duration painted out), thumbnails from the insights list screenshot.
- **Koach** (`#koach`): "every brand needs a pit crew." Krish's K logo (`/assets/logos/koach.webp`, ink-bordered, tilted) sits beside the KOACH wordmark in its lime badge. Three crew tiles with pixel icons (strategy = the race plan, content = the fuel, design = the paint job), "out of the garage" chips (Peeyo, Endura open their project windows; Atovio is a plain chip), and a lime-on-ink ticker of services: two identical groups, each at least the strip's width, both sliding one group-width left, so the loop never shows a gap at any screen width; pauses on hover, static with reduced motion.
- **Finish** (`.podium`): after the checkered finish band, a draggable **racing licence** (go-kart photo; driver, no. 12, team Koach, fuel Red Bull, class "pixel perfectionist", top speed "deadline mode") beside "lap complete. thanks for the ride." and the "fuelled by red bull" meta line.
- **The cat** (`cat.js`): a die-cut kitten sticker (three cats cut out of Krish's memes with OpenCV GrabCut + a white sticker border; the rude one left out). Every hover swaps the cat (tap on touch, Enter on keyboard); drag it anywhere on the page, with edge auto-scroll so it can travel up to the Mac. Its spot (shares of page width/height) and tilt are kept in localStorage.
- **Photos of Krish** used sparingly: the hero photo, the go-kart shot on the licence, and one childhood photo (sunglasses, 6th-grade era) on the back of the flip note ("now ₹1,000. same kid.").
- **Red Bull** runs through the page: the sign-off, the licence, the cans in RACER.DSK, a "what keeps you going?" chat topic and a mascot hint.
- **Backend**: see `docs-backend.md`.


## Extras
- **⌘K palette** (`src/sections/palette.js`, site-wide; also "jump to… ⌘K" in the menu). It opens instantly from the keyboard and animates only from a click. Base commands: pages, theme, email, socials. This page adds projects, Play Racer / Circle (scrolls to the Mac and inserts the disk), High Scores, Talk to Krish, Sound and Mac full screen. Styled as a paper Mac window here, plain elsewhere.
- **Link previews** (`peek.js`): on hover or keyboard focus over outside links (Koach, Instagram, YouTube, LinkedIn, Behance, project pages, email), a mini Mac window appears above the link. The first waits 320ms, the next ones open instantly; it grows from the link.
- **Pixel cursors** (mouse / trackpad only): classic arrow, pointing hand on clickables, open hand on draggables (stickers, notes, disks, knob), fist while holding. Defined as `--cur-*` tokens in creative-mac.css.
- **The race-car mascot** (`mascot.js`, sprites in `car.js`): a Cars-inspired tribute (red, windshield eyes, bumper grin, lightning-bolt decal), with no names, race numbers or logos. Poses: **front** (eyes follow the cursor), **side** (driving, bolt, spinning wheels, flips with direction), **wink**; plus a top-down sprite used as the player car in RACER.DSK.
  - **Mouse:** it follows the cursor around the whole page on separate X/Y springs, sitting behind it. It goes side-on above about 140px/s and faces you when slow, leaves fading tyre marks on fast moves, and gives an idle hint at most every 30s. It hides during games, project windows, ⌘K, full screen, the menu and the record player, fades to 12% over anything pressable (buttons, links, fields, the header, the tab bar, the Mac's screen), and sits below the header, tab bar and every menu (z-index 32).
  - **Touch / reduced motion:** it parks on top of the Mac and gives a hint when tapped.
- **Secret disk**: MESSAGE.MOV is hidden under the welcome note (under the story note on phones). It plays `public/assets/secret/message.mp4` (+ optional `message.jpg` poster). Until that file exists the disk isn't on the desk at all (`secretReady()` in `secret.js`): nothing unfinished on show.
- **Sound** (`sound.js`): Web Audio, synthesised, **off by default**. Toggle with the speaker in the Mac's menu bar or ⌘K. Sounds play only on causal moments: disk in/out, power, boot, alerts, keys, game start / crash / score, the mascot's horn.
- **Cars details:**
  - start lights in the hero (five reds, then green, on load);
  - section numbers as race-number plates;
  - checkered bands ("start" above Work, "finish" before the licence and sign-off, "lap complete");
  - cone and checkered-flag stickers;
  - a speedometer in the bottom-left that shows scroll progress (desktop pointers only);
  - tyre marks from the mascot.

  All original drawings; no film stills or logos.
- **Hover cycling**: a work card cycles through its own project's images on hover (`hover: [...]` in projects.js if set, otherwise the gallery).
- **Blurry placeholders**: every work image has a 20px blurred preview (`data/placeholders.json`) that shows until the real one fades in. After adding images, regenerate the placeholders (the 20px WebP data URIs keyed `slug/NN`).
- **Share previews**: `public/og/{home,data,creative}.jpg` (1200×630) plus og/twitter tags on every page. `__SITE_URL__` is filled at build from `SITE_URL` or Vercel's production URL.

## Motion
Name lines rise (ui-out, 70ms stagger), the rest fades up after. Same eases/durations as MASTER. Reduced motion: no entrance.
