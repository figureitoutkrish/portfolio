# krish viramgama: data scientist / creative

My portfolio, live at **[krishviramgama.vercel.app](https://krishviramgama.vercel.app)**.

One person, two alter egos, and you pick which one to meet:

- **Data** (`/data/`): you drive an F1 car into the pit box, and the steering wheel *is* the page. Its modes show the projects, your own lap read as telemetry, team radio, and LAB, where a tiny neural network written from scratch learns to brake from your drive. Then you get out and walk the garage: the pit wall, an engineers' stand where you can hear a speech-enhancement model clean a radio call, a printer for the CV, a pit board guestbook, and a monitor with my GitHub activity.
- **Creative** (`/creative/`): a desk with a working retro Mac (floppy disks, games with a shared leaderboard, sticky notes visitors leave for each other), then the work, the content and Koach, the creative studio I co-founded.

Short on time? Press **Q** on either page for the quick lap: the 60-second version.

## Stack

Vanilla JS on **Vite** (multi-page), **Three.js** for the garage, **GSAP** + **Lenis** for motion, and **Vercel** functions with **Redis** for the shared bits (leaderboard, notes, pit board, GitHub feed). No framework: every interaction is hand-built.

```bash
npm install
npm run dev       # dev server
npm run build     # production build -> dist/
npm run preview   # serve the production build
```

How it's put together: [`CLAUDE.md`](CLAUDE.md) (structure and conventions), [`design-system/`](design-system/) (the design rules, page by page), [`docs-backend.md`](docs-backend.md) (the functions and the database).

## Credits

- The car: ["F1 2026 concept (polygon model)"](https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42) by [Qvist_designs](https://sketchfab.com/Qvist_Designs), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Converted, simplified and repainted by `scripts/concept-to-glb.mjs` and `src/three/garage/car-livery.js`.
- Radio check clips: speech from LibriSpeech and gunfire from Kabealo & Wyatt's dataset, both CC BY 4.0.
- Nohemi typeface by Rajesh Rajput ([Gumroad](https://rajputrajesh-448.gumroad.com/l/NOHEMI9)), used under its own terms, not this repo's licence.

## Licence

The code is here to read and learn from. My photos, artwork, client work, music, copy and personal content are **all rights reserved**: please don't reuse them. See [`LICENSE`](LICENSE).
