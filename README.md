# Hoang Viet To — Portfolio

Portfolio of an independent software systems builder who turns real-world
operations into reliable products and improves the development loops that ship
them.

## Routes

- `/` — interactive world selector, flagship work, display-swap illustration, contact and CVs
- `/gameonvb` — full-viewport throwable volleyball court and operational product case study
- `/goal-loop` — native SVG shape-and-hole illustration, semantic reference and audited history
- `/playground` — reversible native-scroll System Field with shape controls and a centre pulse

## Stack

React 19, TypeScript and Vite, with native CSS and SVG. Playground independently
lazy-loads GSAP/ScrollTrigger and direct Three.js from `src/playground/` when
motion is allowed. Native scroll remains the sole progress source, and semantic
HTML plus the static SVG node grid remains usable under reduced motion or
WebGL/context failure.

The hub, court and Goal Loop use authored CSS/SVG, not additional WebGL
renderers. The court's animation runs only during visible user-initiated motion
and stops at rest or cancellation. The Goal Loop shape-and-hole scene is an
explicitly illustrative model; it executes no agents, commands, tests or
deployments. Its repair pieces and the court's session contacts are not
operational project metrics.

Current design authority: `docs/playable-worlds-design-contract.md`. The former
VoleyEvents staircase contract and evidence are retained as history, not current
runtime acceptance. Disposable direction studies remain under `sketches/` and
are not included in the production build.

## Commands

- `npm run dev` — start the local Vite server
- `npm run test` — run the Vitest suite
- `npm run check` — type-check without emitting files
- `npm run build` — type-check and create the production build
- `python3 scripts/verify-playable-worlds.py` — browser acceptance against the running localhost:3001 app and existing dedicated CDP Chrome on port 9223; requires Python Playwright. Pass a different base URL as the first argument to verify a production preview. Evidence is saved under `/tmp/portfolio-rebuild/proof/`.

## Deployment

Vite emits the static site to `dist`. Vercel serves that directory and rewrites
`/gameonvb`, `/goal-loop` and `/playground`, including their trailing-slash
forms, to `index.html` for direct loads. Hosting-level misses use the branded
static `404.html` page. Without JavaScript, the current single React entry is
blank; this site does not prerender or server-render routes.
