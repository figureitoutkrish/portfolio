# Data page (`/data/`): "box, box"

Overrides `MASTER.md` for the data alter ego. Plan: `.claude/plans` (Krish approved Oct 2026).

## Concept
First person in an F1 car on a night pit lane (2020 W11 look). The visitor drives in, reverses into
the pit box and parks; the garage wakes up and its stations hold the data side:

| Station | What |
|---|---|
| 01 pit wall | **teach the machine**: a hand-written neural net trains live on points you place |
| 02 garage | **projects** from `src/garage/data/projects.js` (GitHub work; add entries there) |
| 03 debrief | **you are the dataset**: the visitor's own drive, analysed (nothing leaves the browser) |
| 04 team radio | contact links |

No About, numbers or skills: home already has them.

## Look
- Always dark (it's night): `--night`, `--night-2`, `--night-ink`, `--night-muted`, `--night-line`,
  accent `--w11-teal` (#00d2be), `--carbon`. The page overrides `--bg/--fg/--accent` so shared
  components (menu, record player) follow.
- Labels in JetBrains Mono, uppercase, wide tracking; headings Nohemi, lowercase.
- No team or sponsor marks in anything we publish: our garage reads **KV · Krish Viramgama · data
  engineering team**.

## 3D (`src/three/garage/`)
- `index.js` `createGarage(canvas, { quality, reducedMotion, onProgress })` → `{ pose, drive, look, render, dispose }`.
  The page sets `pose` (x, z, heading) and `drive` (speed, rpm, gear, steer, limiter, message);
  the shift lights and the wheel's display follow `drive`.
- `car.js`: uses the W11 from `src/assets/local/w11/` when present (**git-ignored, never
  published**: it's an unlicensed game rip); otherwise the cockpit built in code
  (`cockpit-fallback.js`). `?car=code` previews the published cockpit locally.
- `gloves.js` / `driver.js`: generated gloves, arms (turn with the wheel), suit, lap.
- `lcd.js`: the wheel display (canvas texture, redraws only on change).
- `pitlane.js`: `LAYOUT` (lane along +z, garages on the driver's right at x < −8, our garage at
  z = 0, parking box nose-out), merged static geometry, env map, lights that hop along with the car.
- Quality: `high` = bloom + 4 spill lights + DPR 2; `low` (coarse pointer, < 768px, weak device) =
  no bloom, 2 lights, DPR 1.5. `?q=low|high` forces one. `?nogl` shows the plain page.
- The render loop pauses when the cockpit is scrolled away or the tab is hidden.

## Camera
Eye just behind the helmet (car space 0, 0.99, −0.48), pitched 14° down: the halo frames the top,
the wheel and gloves sit in the lower third (as in Krish's concept image). FOV 58° (wide), 64°
(square-ish), 78° (portrait).

## Fallbacks
- No JS / no WebGL / 3D error → `html.no-gl`: the cockpit is hidden and the stations are the page.
- "skip the drive" is the first focusable element and jumps to the stations.
- Reduced motion: no engine shake; a still frame (drive sequence gets its own path in M2).

## Converting a model
`node scripts/fbx-to-glb.mjs in.fbx out.glb` (geometry + names only; textures are assigned by
material name in `car.js`).
