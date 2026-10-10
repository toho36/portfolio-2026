# T2 — Design tokeny, motion tokeny a rozhraní modulů (Sol)

Závisí na: T1 (schválená kompozice). Blokuje: T3, T4, T5, T5a.

## Cíl
Společný základ, aby moduly T3–T5a šly stavět nezávisle.

## Smí měnit
`src/home/landing/shared/` (tokens.css, motion.ts, types.ts, motion.test.ts), README studie.

## Specifikace
- `tokens.css`: barvy (papír, inkoust, linky, akcent), typografická škála, mezery, rádiusy, breakpointy.
- `motion.ts`:
  - konstanty jen pro konkrétní děje: `P1_STEP 240ms`, `INDEX_SWAP 220ms`, `DETAIL_ZOOM 260ms`, `SWITCH_SWAP 280ms`, `CONTROL_FEEDBACK 140ms`, easing `cubic-bezier(.16,1,.3,1)`.
  - `prefersReducedMotion()` s posluchačem změny.
  - `createDominantMotion()` — jeden globální koordinátor: `start(id, cancel)` zruší běžící dominantní pohyb jiného id; `stop(id)`. Pauza při `document.hidden`.
  - `whenVisible(el, cb)` přes IntersectionObserver, odpojí se po prvním spuštění.
- `types.ts`: rozhraní modulů `{ mount(el, content): () => void }` nebo React props pro Hero/P1, Rejstřík, Jak pracuju, Screen Switch.

## Kritéria přijetí
- Test: druhý `start` zruší první (cancel zavolán právě jednou); reduced-motion vrací nulové délky; hidden dokument pauzuje.
- Žádná globální rAF smyčka.

## Kontroly
`npm run check`, `npx vitest run src/home/landing/shared`.

## Doplněk 2026-10-10 (HorizonX analýza)
- `motion.ts` navíc: `scrubReveal(el, timeline)` přes GSAP ScrollTrigger `scrub` — obousměrné (scroll zpět = čistý návrat), registrované v `createDominantMotion`, reduced-motion = koncový stav bez ScrollTriggeru.
- Test: reduced-motion nevytvoří ScrollTrigger; dispose odstraní trigger.
