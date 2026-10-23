# Hoang Viet To — Portfolio

A React single-page portfolio for Hoang Viet To, Software Developer. The homepage
opens with an arena introduction, followed by a deck of project cards and
supporting sections about the work, tools, Screen Switch and contact, including
a contact form and downloadable CVs.

## Pages

- `/` — homepage deck and supporting sections.
- `/gameonvb` — volleyball event operations case study with an interactive 3D
  volleyball and staircase.
- `/goal-loop` — software delivery story covering planning, critique, checks and
  review, presented through animated illustrations.
- `/playground` — Hot Wire, a 3D wire skill game with difficulty, sound and local
  best runs, plus the Villa study.
- `/playground/lego-villa/index.html` — a scroll-driven villa assembly animation
  rendered from a WebP image sequence.

## Stack and commands

React 19, TypeScript, Vite, Three.js and CSS. Vitest runs the tests in `src/`.
The SPA entry point is `src/main.tsx`; `src/App.tsx` handles routing and metadata.

- `npm run dev` — start the Vite development server.
- `npm test` — run the Vitest suite.
- `npm run check` — type-check without emitting files.
- `npm run build` — type-check and build the static site into `dist/`.

## Folder map

- `src/content/` — route metadata, project copy and Goal Loop history data.
- `src/home/` — homepage card deck, arena intro, supporting visuals and contact
  form behavior.
- `src/pages/` — page components and their motion code.
- `src/components/` and `src/gameonvb/` — staircase component and 3D runtime.
- `src/playground/` — Hot Wire runtime, rules, scoring and Playground styles.
- `src/styles.css` and `src/worlds.css` — shared site styles.
- `public/` — static media, CVs, crawler files, hosting 404 and the Villa study.
- `docs/know-how/` — retained technical lessons and supporting study sources.
- `sketches/` — test fixtures retained from promoted studies, outside the
  production entry graph.

## Deployment

Vercel deploys from `main` and serves `dist/`. `vercel.json` rewrites the three
non-root SPA routes, including trailing-slash forms, to `index.html`; it also
redirects `/voleyevents` to `/gameonvb`. Other missing pages use `public/404.html`.
The SPA is rendered in the browser; it does not prerender or server-render routes.
