# Hoang Viet To — Portfolio

Portfolio of an independent software systems builder who turns real-world
operations into reliable products and improves the development loops that ship
them.

## Routes

- `/`: poster slider, flagship work, display-swap illustration, contact and CVs
- `/gameonvb`: directly throwable 3D volleyball on a fixed stone staircase, with the complete operational story
- `/goal-loop`: goal-free animated calibre anatomy, free orbit/zoom, reversible opening and part inspection, with semantic reference and audited history
- `/playground`: VITEK hot-wire game, difficulty, sound and local best-run feedback

## Stack

React 19, TypeScript and Vite. Home owns its lazy poster runtime under
`src/home/`, Playground owns its wire runtime under `src/playground/`, and
GameOnVB loads Three only through `src/gameonvb/loadStaircaseView.ts` after its
stage is eligible and visible. No new dependency or physics engine is added.

The staircase runs only during visible user-initiated motion and impact settle.
Capture loss does not roll back a throw; Escape explicitly restores the caught
pose. React route exit cancels loading and removes canvas, listeners and GPU
resources. Reduced motion and missing/lost WebGL retain native SVG placement
and the complete four-stage HTML story. Three real landings highlight three
reading chapters; they execute no registrations, payments or backend actions.
Goal Loop owns the promoted calibre under `src/goal-loop/calibre/`, with the React wrapper in `src/components/Calibre.tsx`. Three and OrbitControls load only through its visible eligible route-local loader. Reduced motion initially loads neither and retains the scoped SVG anatomy; route exit cancels imports and disposes listeners, observers, canvas and GPU resources. Cached-page return preserves assembly, selection, camera and paused mechanism phase. The viewer is an illustration, not a live agent run or a task to solve.

Current design authority: `docs/playable-worlds-design-contract.md`. The former
VoleyEvents staircase contract and evidence are retained as history, not current
runtime acceptance. Disposable direction studies remain under `sketches/` and
are not included in the production build.

## Commands

- `npm run dev` — start the local Vite server
- `npm run test` — run the Vitest suite
- `npm run check` — type-check without emitting files
- `npm run build` — type-check and create the production build
- `python3 scripts/verify-goal-loop-calibre.py http://127.0.0.1:5181`: integrated calibre acceptance against the built portfolio, including native mouse/touch, reduced motion, missing/lost GPU, SPA teardown, delayed import cancellation, actual BFCache restoration and other-route lazy isolation. Uses installed Python Playwright and an owned system Chrome; evidence gets a unique directory under `~/.hermes/cache/scratch/`. Physical-phone and real hidden-tab acceptance are explicitly separate.
- `python3 scripts/verify-gameonvb-staircase.py http://127.0.0.1:5181`: integrated route acceptance, native gestures, fallback, teardown and all-route layout/lazy-isolation smoke against a built preview; uses installed Python Playwright and dedicated Chrome CDP on port 9223. Evidence goes to `~/.hermes/cache/scratch/gameonvb-staircase-proof/`. The older playable-worlds verifier is historical and does not describe the current poster, wire or staircase surfaces.

Local production preview: `./node_modules/.bin/vite preview --host 127.0.0.1 --port 5181 --strictPort` after `npm run build`. Local implementation is verified separately from deployment. Physical-phone GPU acceptance remains pending; emulated touch is not phone proof.

## Deployment

Vite emits the static site to `dist`. Vercel serves that directory and rewrites
`/gameonvb`, `/goal-loop` and `/playground`, including their trailing-slash
forms, to `index.html` for direct loads. Hosting-level misses use the branded
static `404.html` page. Without JavaScript, the current single React entry is
blank; this site does not prerender or server-render routes.
