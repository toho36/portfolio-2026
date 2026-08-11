# Hoang Viet To — Portfolio

Portfolio of an independent software systems builder who turns real-world
operations into reliable products and improves the development loops that ship
them.

## Routes

- `/` — systems-builder overview, flagship work, side projects, contact and CVs
- `/voleyevents` — operational product case study
- `/goal-loop` — bounded software-delivery system case study

## Stack

React 19, TypeScript and Vite, with native CSS/SVG motion. The shipped portfolio
does not require a 3D renderer or a separate animation runtime.

## Commands

- `npm run dev` — start the local Vite server
- `npm run test` — run the Vitest suite
- `npm run check` — type-check without emitting files
- `npm run build` — type-check and create the production build

## Deployment

Vite emits the static site to `dist`. Vercel serves that directory and rewrites
the two case-study routes, including their trailing-slash forms, to `index.html`
for direct loads. Hosting-level misses use the branded static `404.html` page.
