# Data page (`/data/`): the wheel is the interface

Overrides `MASTER.md` for the data alter ego.

## Concept (one flow, nothing outside it)
1. **Cockpit:** first person in an F1 car (2020 W11 look) on a floodlit night pit lane. The opening line is "every project has a starting grid.", with **take the wheel** and **skip to the garage**.
2. **Drive in (about 20–30s):** past the garages, stop just past ours, hold S to reverse into the box, and park on the marks.
3. **The zoom:** the camera dollies into the steering wheel, and the 3D wheel hands over to the **HTML wheel**, which is the page from then on.
4. **Returning visits and reduced motion** land straight on the wheel. **No WebGL** gives the same wheel, without PIT. **No JS** gives a `<noscript>` list.

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
| SCROLL rotary | ↑ ↓ · wheel · drag the knob | scroll the screen |
| OK | enter | open the briefing → open the code; LAP: drive again; RADIO: open the channel |
| BACK | esc / backspace | close the briefing |
| PIT | – | back in the car at the pit entry |
| DRS · TALK · DRINK | – | short radio moments on the screen bar |
| shift lights | – | position (project n of N; on LAP, how close you parked; on RADIO, the channel) |

- **PROJECTS:** `src/garage/data/projects.js`. Add a project there and the wheel picks it up.
- **LAP:** `telemetry.js` records the drive (10 Hz in sessionStorage, never sent anywhere). The screen shows:
  - the speed trace, with throttle and brake bands and the reverse dashed;
  - lap time, reaction, top speed, braking point before the box, corrections, cm off the marks;
  - a style call from five plain rules, with the rule that fired highlighted.
- **RADIO:** a short exchange, then email, LinkedIn, GitHub, Instagram.
- **Layout:** the wheel is drawn in a 900×400 viewBox; controls are placed in % of it and sized in container units. Phones (≤ 760px) get a tall wheel with a big screen.

## Look
- **Colours:** always dark. Tokens `--night`, `--night-2`, `--night-ink`, `--night-muted`, `--night-line`, `--w11-teal` (#00d2be), `--carbon`.
- **Type:** mono (JetBrains Mono) for labels and the wheel's UI; Nohemi for titles. No team or sponsor marks in anything published (our garage sign reads KV).
- **3D:** floodlit night (hemisphere + flood + fill lights), lighter asphalt and walls, exposure 1.3, thin blue fog, no bloom, environment reflections at 0.22, little clearcoat. No halo: it's removed from the W11 at load and not built in the code car.

## 3D (`src/three/garage/`)
- `index.js` `createGarage()` returns `{ pose, drive, look, view, hold(on), onFrame, render }`:
  - `view.zoom` 0…1 moves the camera from the driver's eye to face the wheel;
  - `view.fit` / `view.offsetY` size and place it so it lines up with the HTML wheel;
  - `hold(true)` stops drawing while the HTML wheel covers the scene.
- `car.js` uses the W11 from `src/assets/local/w11/` when present (**git-ignored, never published**: an unlicensed game rip). Otherwise it uses `cockpit-fallback.js`. `?car=code` previews the published one.
- `gloves.js` / `driver.js` (generated), `lcd.js` (the wheel display), `pitlane.js` (the lane; numbers in `src/garage/layout.js`).
- Quality: `low` on touch, small or weak devices (DPR 1.5, 2 spill lights). `?q=` forces it; `?nogl` gives the plain wheel.

## The drive (`src/garage/`)
- `vehicle.js`: a guided kinematic model, pure and testable in Node:
  - 80 km/h limiter;
  - 4 gears, revving to about 11.8k;
  - eased stop past our garage;
  - hold S to reverse along a fixed curve into the box;
  - parked within 0.3 m.
- `drive.js`:
  - phases on `html[data-drive]`: intro · driving · paused · parked · wheel;
  - keys, touch pedals and drag-to-steer;
  - the HUD (status, the parking diagram, the controls);
  - the engine (`loop('f1')`) and one-shots;
  - the zoom handover to the wheel.
- While driving: no page scroll, the tab bar steps aside, Esc pauses. Shake is light, and none once parked.

## Converting a model
`node scripts/fbx-to-glb.mjs in.fbx out.glb` (geometry and names only; materials are assigned by name in `car.js`).
