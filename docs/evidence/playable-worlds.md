# Playable-worlds rebuild acceptance

Status: local implementation and production-preview verification passed. No commit, push or deployment. Existing development server remains at http://localhost:3001/.

## Verified artifact

Production entry: `dist/assets/index-CBZquo_s.js`
SHA-256: `5d6082a83e164e52c45b2944fa2b3b1d4ee4cbc1b3a92d8e2b97dd55c79167ae`

Authority: `../playable-worlds-design-contract.md`.

## Delivered

- Home: selectable visual worlds, keyboard range control, direct route links and a reversible Screen Switch display illustration.
- GameOnVB: full-viewport court using the live site’s dark-purple/yellow palette and exact transparent 180×180 pixel volleyball asset (SHA-256 `862081da128cfd56b9ced92bfcd220d7f7c367225815f2f0d2697b590738ad6b`), with pointer/touch throw, parallax depth, contact energy, native Serve/Reset, bounded settling, cancellation and reduced-motion placement; full sourced lifecycle remains below. `/voleyevents` redirects here. Old staircase runtime/loaders, their exclusive tests and budget checker removed, historical evidence preserved.
- Goal Loop: `A GOAL. A LOOP. A VERDICT.` leads a six-stage stepper plus one focused current-stage panel; stage-specific primary action and contextual revision/repair note replace the rejected freeform SVG state map. Bounded repair, pass/block, replay and native semantic stage disclosures remain. Sourced audited history is unchanged; the mobile primary action stays in the entry viewport.
- Playground: distinct vermilion theme, entry shape links, centre pulse through the existing renderer controller, native reversible scroll and SVG/no-WebGL fallback.

## Fresh checks

- `npm run test`: 22 files, 194 tests passed. The former rally's exclusive tests were retired with the removed runtime; source/privacy/navigation/history/Playground tests remain, and new court/model/pulse cases were added.
- `npm run check`: passed.
- `npm run build`: passed. Existing lazy Three.js vendor chunk warning remains; no new dependency.
- `git diff --check`: passed.
- `python3 scripts/verify-playable-worlds.py http://127.0.0.1:3002`: passed against the built production preview, not the dev compiler.

## Browser matrix

All four routes (`/`, `/gameonvb`, `/goal-loop`, `/playground`) at 320, 390, 768, 1024 and 1440 CSS px: 20 layout fixtures, no horizontal overflow, one shared header/main, truthful route metadata, readable theme navigation. At 390×844 each primary interaction is reachable in the first viewport.

Real browser actions passed:

- Home pointer selection, keyboard range, repeated display swap and direct navigation.
- Court actual mouse drag-release, serve, Escape cancellation, keyboard serve and idle settling.
- Instrument failed check → repair → same check → pass; bounded repeated failure → block; Back/Reset, native reference disclosure and keyboard focus after repair.
- Field pulse without changing scroll, forward/reverse shape navigation, repeated route enter/leave without extra canvases, browser Back.
- Reduced motion across all four routes: no canvas, static field feedback and ball placement.
- Emulated touch: native tap serve and touch drag-release.
- WebGL explicitly unavailable: visible SVG fallback, usable pulse feedback, no canvas or uncaught error.

Normal fixture page/console errors: zero. The deliberately disabled-WebGL fixture checks graceful fallback and zero uncaught page errors; the renderer's expected unavailable-context diagnostic is not treated as a normal-console claim.

Machine-readable browser output and screenshots: `/tmp/portfolio-rebuild/proof/`. Reproduce with the committed-path script while the local app and dedicated CDP browser are running. The temporary production-preview server was used only for acceptance.

## Fixes caught by runtime/review

- Removed the body’s 320px minimum width that overflowed after desktop scrollbar allocation.
- Moved mobile world/serve/model controls before their large visual surfaces.
- Restored pointer events only on Playground’s new control group; the decorative hero no longer makes its buttons click-through to canvas.
- Returned keyboard focus to Next stage when Repair removes its own button.
- Removed duplicate GameOnVB introductory copy and resolved inherited light-theme navigation colors.
- Made route-entry scroll resets `instant`; `auto` inherited global smooth scrolling and moved new-page interaction targets after navigation. Frame samples now stay at zero immediately after the route change.

## Not claimed

No physical-phone GPU/Safari certification, production deployment, live product/agent execution, or implementation of the superseded monumental Three.js staircase. The current court is an authored CSS/SVG interaction, intentionally not represented as that earlier renderer candidate.
