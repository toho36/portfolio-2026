# Hoang Viet To — Portfolio

Portfolio of an independent software systems builder who turns real-world
operations into reliable products and improves the development loops that ship
them.

## Routes

- `/` — systems-builder overview, flagship work, side projects, contact and CVs
- `/voleyevents` — operational product case study
- `/goal-loop` — bounded software-delivery system case study
- `/playground` — reversible native-scroll Signal Relay experiment

## Stack

React 19, TypeScript and Vite, with native CSS and SVG. Playground lazily loads
GSAP and ScrollTrigger from `src/playground/` when motion is allowed; semantic
HTML/SVG remains the reduced-motion fallback and Three.js remains gated by the
separate spatial-value experiment.

## Commands

- `npm run dev` — start the local Vite server
- `npm run test` — run the Vitest suite
- `npm run check` — type-check without emitting files
- `npm run build` — type-check and create the production build

## Deployment

Vite emits the static site to `dist`. Vercel serves that directory and rewrites
`/voleyevents`, `/goal-loop` and `/playground`, including their trailing-slash
forms, to `index.html` for direct loads. Hosting-level misses use the branded
static `404.html` page. Without JavaScript, the current single React entry is
blank; this site does not prerender or server-render routes.
