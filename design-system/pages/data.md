# Data page (`/data/`): the wheel is the interface

Overrides `MASTER.md` for the data alter ego.

## Concept (one flow, nothing outside it)
1. **Cockpit:** first person in an F1 car (2020 W11 look) on a floodlit night pit lane. The opening line is "every project has a starting grid.", then the objective in one sentence ("box this lap: get under 80 before the pit entry line, limiter on, and stop on your crew's marks."), with **take the wheel** and **skip to the garage** (a dark pill, so it reads over the car).
2. **Drive in (about 20s), the way it's done in F1** (researched; sources in the commit that made it):
   - you take over rolling at 110 km/h; brake under 80 before the **pit entry line**, and press **L** (touch: PIT) for the limiter as you cross it;
   - down the fast lane on the limiter (it stutters the engine and blinks the shift lights);
   - turn right into **your box** in the working lane and stop on the crew's marks (the front tyres on the white T);
   - jack up, wheel guns, jack down; then **the mechanics push the car back into the garage**, nose out. F1 cars almost never reverse, so you don't.
3. **The zoom:** the hands come off and the camera dollies into the steering wheel. **The real 3D wheel is the device**, like the Mac on the creative page:
   - the page's screen sits exactly over the wheel's display;
   - its physical buttons and knobs are the controls (focusable hotspots with printed labels over them);
   - pressing one presses the 3D part, and the 3D shift lights show your position.
4. **Returning visits and reduced motion** land straight on the wheel. **No WebGL** gives a drawn HTML wheel with the same controls, without PIT. **No JS** gives a `<noscript>` list.
5. **The way in is marked, like a real pit lane:**
   - the pit entry line across the lane, with 80 boards either side;
   - teal chevrons down the fast lane, then four that swing right toward the box;
   - distance boards hung from the garage fronts (100 / 50 / 25 m to the box);
   - our box: the car's outline in teal, the white T, KV; the crew at their stations (lollipop reading BRAKES, the front jack, a gunner at each corner).
   - the HUD backs it up: a status line saying what to do next, a goal card (what you're aiming for, how far, your speed against 80, limiter on/off) and, for the last 33 m, the box from above.

Rules that came out of Krish's review:
- experience over visual fidelity: bright, readable, light rendering;
- no section that can't justify itself inside the metaphor;
- no About, numbers or skills (home has them).

## The wheel (`src/garage/wheel.js`, `modes/`, `styles/wheel.css`)
Every control is a real button with one job:

| Control | Keys | Job |
|---|---|---|
| paddles − / + | ← → · swipe the screen | previous / next |
| MODE rotary | 1 2 3 | projects · lap · radio (LAB comes later) |
| SCROLL rotary | ↑ ↓ · wheel · drag the knob | scroll the screen; in the radio check it's the model dial (relabelled **model**) |
| OK | enter | open the briefing → open the code (or the radio check); LAP: drive again; RADIO: open the channel |
| BACK | esc / backspace | close the briefing |
| PIT | – | back in the car at the pit entry |
| GET OUT | E | out of the car to walk the garage (below) |
| OVERTAKE · TALK · DRINK | – | short radio moments on the screen bar; TALK plays a radio call over gunfire that the noise model cleans up after a second |
| shift lights | – | position (project n of N; on LAP, how close you parked; on RADIO, the channel) |

- **PROJECTS:** `src/garage/data/projects.js`. Add a project there and the wheel picks it up.
- **The radio check** (`src/garage/radio-check.js` + `src/audio/radio-check.js`): project 01, the speech-enhancement build, has a third level instead of "open the code". Card → OK → briefing → OK → check.
  - A real test-set clip (a voice the model never trained on, under gunfire) loops on the display. The raw recording and the model's output play in lockstep, and the dial crossfades them (equal power).
  - The waveform's gunshot spikes shrink to the voice as you turn; what was removed stays as a red ghost. The shift lights fill with the model's share. Paddles change clip (3), OK plays / stops, BACK returns to the briefing.
  - On phones the slider on the display is the dial (the hint says "slide"); a drag on it is never a swipe.
  - Clips: `public/assets/audio/radio-check/<id>-raw.m4a` / `-model.m4a` (16 kHz AAC, ~25 KB each), listed in the project's `check` field with their SNR before/after. Speech from LibriSpeech, gunfire from Kabealo & Wyatt's dataset, both CC BY 4.0 (credited on the screen).
  - Each new check opens raw (0%) so the first turn is the reveal; leaving the level, switching mode or PIT stops the audio.
- **LAP:** `telemetry.js` records the drive (10 Hz in sessionStorage, never sent anywhere). The screen shows:
  - the speed trace, with throttle, brake and limiter bands;
  - lap time, reaction, top speed, braking point before the box, corrections, cm off the marks;
  - a style call from five plain rules, with the rule that fired highlighted.
- **RADIO:** a short exchange, then email, LinkedIn, GitHub, Instagram.
- **Overlay (with 3D):** `src/three/garage/controls.js` builds the physical controls per car from `car.controlSpots`. On the W11 they sit on the wheel's own knobs and buttons, found by scanning its face for bumps.
  - `garage.wheelLayout()` projects the display and each control to CSS px; `wheel.attach(surface)` lays the screen and the hotspots over them.
  - Compact framing (phones, and tablets held upright: `wheel.setCompact`): the display fills the width (94% on phones, 72% on tablets), sits just under the header, and a dock of caps (‹ back mode ok ›) stands in for the controls off-screen.
  - Hotspots are always 44px targets; the hover/focus ring hugs the real button (`--ring`). The 3D part presses on pointer-down / key-down, the action fires on release.
- **Drawn (no WebGL):** a 900×400 SVG wheel with the controls placed in % of it; phones get a tall layout.

## Free roam: out of the car (`src/garage/roam-ui.js`, `src/three/garage/roam.js`)
For visitors who'd rather walk than read on the wheel. Inspired by the 3D world on Vivaan Jasapara's site, done first person so it carries on from the cockpit.
- **In the car before the drive** the view follows the mouse ±30° / ±11° (listened for on the cockpit, since the intro covers the canvas); while driving it's a glance (±6° / ±3°).
- **Getting out:** **GET OUT** under the wheel (E; on phones, OUT in the dock). The gloves come off, the steering wheel unclips and rests on the nose (real drivers take it off to climb out), and the camera rises out of the cockpit, over the sidepod on the gantry side, and down to standing height (1.68 m) beside the car (2.1 s; a cut under reduced motion). The driver's body hides and the halo shows. **Getting in:** E near the car, or the car station; the reverse move, then the zoom back into the wheel.
- **Moving:**
  - W S / ↑ ↓ walk (shift runs), A D step sideways, ← → turn; click the floor to walk there (sidestepping people and props; a ring marks the spot);
  - **looking round:** rest the mouse in the outer 20% of the view and you turn that way (faster toward the edge; the cursor shows it), or drag, or swipe sideways on a trackpad. The first tip after getting out says so;
  - click or tap anything with a station to open it; 1–7 jump to a station; Esc steps back from it;
  - collisions keep you out of the car, props and crew (2D boxes with a 0.3 m body); you can walk the garage and the pit box in front of it.
- **Stations** (the strip along the bottom lists them all; it's real buttons, so keyboard and screen-reader users never need the 3D):

| key | station | content |
|---|---|---|
| 1 | pit wall gantry | each monitor is a project: its briefing laid over the screen; ‹ › moves along the monitors; the noise project's "hear it" goes to 2 |
| 2 | engineers' stand | the radio check on the big monitor; the console's red LED meters follow the audio level (`checkLevel()`) |
| 3 | wall TV | LAP; drive it again / take the wheel |
| 4 | the car | a line about the 2026 car; get in (E) |
| 5 | printer | prints the CV: a sheet feeds out, then `/assets/cv/krish-viramgama-cv.pdf` downloads (source: `scripts/cv.html`, one A4 page; reprint with the command at its top) |
| 6 | pit board | the guestbook: up to 28 characters, chalked onto the 3D board (the newest shows on arrival); `api/pitboard.js`, 3 per hour per IP, same word rules as the notes; this browser only until Upstash is connected |
| 7 | team radio | the headset on its hook: email, LinkedIn, GitHub, Instagram as menu rows |

- **Focus:** the camera glides to frame the station (in-out ease; glides across the garage swing through the open floor behind the car, never through walls). Screens (1–3) get their HTML laid over the projected screen on wide screens; objects get a panel docked on the right with the object kept to its left. Phones get a bottom sheet with the station framed above it.
- **The garage radio** (`src/garage/garage-radio.js`): a boombox on the cabinets right of the TV, with speaker cones that pump with the level and a display that reads KV FM.
  - **Proximity:** quiet across the garage, louder and brighter as you walk up. The volume and a lowpass filter follow your distance (1.2 → 15 m), and it's panned to the side it's on.
  - **The track:** Krish's own "F1" (`public/assets/audio/garage/f1.mp3`, 3 MB at 128 kbps), fetched only the first time you get out, so the page itself stays light. If it can't load, an original 8-bar loop (112 bpm, Am F C G) generated in Web Audio plays instead. The display reads KV FM · F1.
  - **Stepping aside:** it pauses for the header's record player (`record:change`), mutes with the site's sound switch, dips to 45% while a station is open and 6% for the radio check, and fades out when you get back in.
  - **Controls:** click the radio or press M to turn it on or off.
- **Life:** the crew shift their weight and turn their heads (with their headsets) toward you within 4.5 m; the session clock on the gantry counts your time on the page (red past an hour); the gantry and canopy screens drift; garage ambience plays under it all (a low rumble, cars on the straight, other teams' wheel guns). Footsteps follow your stride, and the printer, chalk and drink each have a sound. Stand in the pit box for 4 s and the radio calls "box, box!". The fridge has drinks.

## The garage (`src/three/garage/garage-props.js`, `car-body.js`)
Dressed from Krish's photos of a team garage:
- **Pit wall gantry** (+z wall): a desk with a radio rack of red LEDs, five monitors (the project titles when idle), the canopy with the session clock between weather and onboard screens, the printer at the end, a headset.
- **Engineers' stand** (−z wall): an octagonal console, one big monitor over the LED radio console, the headset on its hook, four chairs.
- **Back wall:** the wall TV, tool cabinets with lit handles, the fridge, a race suit on a stand and two helmets, the tyre allocation board (S ×8, M ×3, H ×2).
- **Over the car:** the light box on cables, four coiled air lines, and a cooling duct into the sidepod. The pit board stands by the door.
- **Crew:** people in team kit (white shirts, dark trousers, headsets, arms behind their backs), placed to leave a lane either side of the car. When the car's in the garage, the gunners at the box stand down.
- **The car** (`car-body.js` adds to `cockpit-fallback.js`): engine cover with the airbox and a teal spine, a rain light, the flat floor and diffuser, rear wheels on the same rig, an active-aero rear wing (`setAero`) and front main plane, the 01 · KV flank numbers, and the halo (shown from outside only). The W11 stays local-only as before.

## Look: the F1 game's UI (`src/styles/f1ui.css`)
Studied from the current game (EA's F1 25 with the 2026 Season Pack; there is no standalone F1 26) using EA's own in-game screenshots: the race HUD and the menus. Our team throughout: KV in teal, with no F1 marks, font, team names or drivers.
- **Panels:** `--f1-panel` (near-black, blurred) with a 1px light top edge (`--f1-edge`) and 3px corners. Session header `.f1-head`: the KV mark on teal, then the session ("box 01").
- **Type:** Saira (OFL, `@fontsource-variable/saira`, width axis) at `--f1-stretch` 118%, 600–800, uppercase for headings, labels, tags and buttons. Big titles are 800 italic, like the game's. JetBrains Mono for numbers and small data. Reading text stays lowercase Saira 500. Nohemi isn't used on this page.
- **Colour:** always dark; teal `--f1-team` is the accent. The timing colours mean the same thing everywhere: `--f1-purple` = best, `--f1-green` = good, `--f1-yellow` = slower, `--f1-red` = a limit broken. Violet `--f1-objective` is for the objective only.
- **Components:**
  - `.f1-tag` (section tag in teal);
  - `.f1-key` (a key cap);
  - `.f1-rows` / `.f1-row` (zebra rows, the selected one outlined);
  - `.f1-info__t` (title with a short teal underline);
  - `.f1-objective` (violet pill with a diamond);
  - `.f1-sectors` (S1/S2/S3);
  - `.f1-gauge` (270° ring, set from JS);
  - `.f1-prompts` (key prompts, bottom right);
  - `.f1-btn` / `--primary`;
  - `.f1-streaks` (the moving light behind menus; still under reduced motion).
- **Where they're used:**
  - **Loader:** an install-style checklist (3d engine, pit lane, car & textures, team radio), each ticked when that part has really loaded (`createGarage({ onStage })`). The percentage holds under 100% until the car is in.
  - **Intro:** session header, the title in 800 italic, the objective pill, **take the wheel ↵** (Enter starts) and **skip to the garage**.
  - **Drive HUD:**
    - top left: the session box (phase, your time) and the objective, the only part announced to screen readers;
    - top right: the sector box. S1 is your speed at the pit entry line (purple 74–80, green under, red over 80). S2 is where the limiter went on (purple within 5 m of the line, green early or within 25 m, yellow later). S3 is the distance from the marks (purple ≤ 50 cm, green ≤ 1.5 m, yellow beyond). The live sector fills as you go, and the distance to the next target sits under the box.
    - bottom centre: BATT, gear plus the LIM light (blue, flashing on the limiter), and speed (red over 80 near the lane). BATT drains on the throttle and refills under braking; it's display only.
    - prompt bar bottom right (hidden under 1100px), skip bottom left, and the box from above for the last 33 m.
    - touch: the panels go half width, the sectors read S1 S2 S3, and the gauges sit above the pedals.
  - **Pause:** a menu panel (resume esc, skip).
  - **Wheel screen:**
    - the mode is the teal tag and the hints are key prompts;
    - titles in 800 italic uppercase, the stack as small tags, the briefing sections as info titles;
    - links as buttons (code teal, live dark);
    - "ok radio check" as the objective pill;
    - LAP stats as a timing tower, with the style call that fired in purple;
    - RADIO channels as menu rows.
- **Legibility floor:** screen text scales with the display but never goes below 11px for labels (`--lab`) or 13px for reading text (`--txt`). On phones the screen grows down over the wheel's face to just above the next row of buttons, and off-screen hotspots are hidden (out of the tab order). The dock adds **PIT**.
- **2026-correct:** the cars have no DRS any more, so that wheel button is **OVERTAKE** (the electric boost; "+350 kW · not in the pit lane").
- **3D:** floodlit night (hemisphere + flood + fill lights), lighter asphalt and walls, exposure 1.3, thin blue fog, no bloom, environment reflections at 0.22, little clearcoat. No halo in the cockpit view: it's removed from the W11 at load and not built in the code car.

## 3D (`src/three/garage/`)
- `index.js` `createGarage()` returns `{ pose, drive, look, view, hold(on), onFrame, render }`:
  - `view.zoom` 0…1 moves the camera from the driver's eye to face the wheel;
  - `view.fit` / `view.offsetY` size and place it so it lines up with the HTML wheel;
  - `hold(true)` stops drawing while the HTML wheel covers the scene.
- `car.js` uses the W11 from `src/assets/local/w11/` when present (**git-ignored, never published**: an unlicensed game rip). It reaches it through `virtual:local-models` (`localModelsPlugin` in `vite.config.js`), which lists the files on the dev server and is empty in every build, so even a build made on Krish's Mac can't contain it. Otherwise it uses `cockpit-fallback.js`, built from scratch to read like the local W11 (the W11 is only a visual reference; nothing of it is copied):
  - `wheel-model.js`: carbon body with raised top corners, sculpted rubber grips, a gloss bezel with the display, a domed shift-light slot, unassigned buttons and a KV emblem. The controls sit at the same `controlSpots` as the W11, so the overlay is identical.
  - `chassisRing()`: one lofted chassis, an open U-tub around the driver closing into a low front deck and the nose, with teal pinstripes on the cockpit rim and the nose.
  - `?car=code` previews the published one locally.
- `gloves.js` / `driver.js` (generated), `lcd.js` (the wheel display), `pitlane.js` (the lane; numbers in `src/garage/layout.js`).
- Quality: `low` on touch, small or weak devices (DPR 1.5, 2 spill lights). `?q=` forces it; `?nogl` gives the plain wheel.

## The drive (`src/garage/`)
- `vehicle.js`: a kinematic bicycle model, pure and testable in Node (`createVehicle()`; a scripted driver lives in the scratchpad, not the repo):
  - the rear axle follows the heading; yaw rate = v · tan δ / wheelbase, with the W11's wheelbase (3.715 m, measured off the model);
  - ±18° at the front wheels, ±180° at the steering wheel (a 10:1 ratio); a key asks for less lock the faster you go, and steering is capped by grip (~2.2 g), past which the car runs wide;
  - the limiter (80 km/h) is a toggle, as in the car; F1 gearing, so the lane is 1st and 2nd, revving to about 11.8k before each shift, with blipped downshifts;
  - the brake builds pressure over ~0.2 s; the pit wall and the garages are soft walls you glance off;
  - stopping anywhere from 12 m before the box counts (the error is recorded); then `push()` walks the car back into the garage along a curve in 3–4.5 s.
- The scene steers the front wheels about a kingpin and rolls all four (`car.wheels`; on the W11 the hubs get pivot groups since its nodes carry no transforms), turns the steering wheel by the real ratio, and lifts the nose on the jack (`pose.lift`).
- `drive.js`:
  - phases on `html[data-drive]`: intro · driving · paused · parked · wheel;
  - keys (W S A D, L for the limiter), touch pedals, the PIT button and drag-to-steer;
  - the HUD (session box, objective, sectors, gauges, the box from above, the key prompts);
  - the stop: `service()` (jack, guns, the gunners go round to push) → `vehicle.push()` → `park()`;
  - the engine (`loop('f1')`) and one-shots;
  - the zoom handover to the wheel.
- While driving: no page scroll, the tab bar steps aside, Esc pauses. Shake is light, and none once parked.

## Converting a model
`node scripts/fbx-to-glb.mjs in.fbx out.glb` (geometry and names only; materials are assigned by name in `car.js`).
