# T1 — Statická kompozice celé stránky (Sol)

Závisí na: T0, T0a. Blokuje: T2.

## Cíl
Izolovaná studie celé homepage BEZ pohybu, která prokáže hierarchii, rytmus a mobil.

## Smí měnit
- `src/home/landing/` (nová složka): `LandingPage.tsx` (statická kostra 4 celků), `landing.css`, `LandingPage.test.ts`. Komponenta zatím NENÍ připojená na žádnou trasu.
- `sketches/025-landing/` (nová složka): `index.html` + `main.tsx` jen jako náhledový harness, který připojí `LandingPage`; `README.md`.
- Vše ostatní v `src/` read-only (obsah se importuje z `src/content/`).

## Specifikace
- 4 celky: Hero (s P1 v koncovém stavu), Rejstřík, Jak pracuju, Kontakt.
- Typografie: 2 písma (serif display, grotesk text/UI). Nadpis hera 54–64 px na 1440, prostrkání −3 %, řádkování 1.0–1.1. Text 17–18 px.
- Pozadí papírově tmavé (ne #000). Jeden akcent jen pro stav (aktivní řádek, fokus).
- Rytmus sekcí: H2 vlevo, akce vpravo na stejném účaří.
- Rejstřík: všechny 4 projekty + odkaz Playground viditelné na 1440×900 bez dalšího scrollu po vstupu do sekce. SolidPixels má největší váhu.
- Mobil (390): vlastní kompozice. P1 na celou šířku s předem komponovaným výřezem, text v panelu min. 12 px. Rejstřík jako seznam s rozbalovacím detailem (`<details>` nebo button + region).
- Stavy navíc: Rejstřík s otevřeným detailem SolidPixels; reduced-motion = stejné.

## Kritéria přijetí
- Na všech viewportech z _COMMON bez horizontálního přetečení a bez překryvu navigace a obsahu.
- Kontakt dosažitelný z hera jedním odkazem.
- HTML obsahuje jméno, roli a odpovědnost jako text.
- Screenshoty všech viewportů + otevřený detail. Krátký README se zdůvodněním kompozice.
- Review Astrou (read-only) nad screenshoty před T2. Výsledek se uloží do `sketches/025-landing/review/`.

## Kontroly
`npm run check`; `npx vitest run src/home/landing`; `node node_modules/vite/bin/vite.js build sketches/025-landing --config vite.config.ts --outDir /tmp/landing-025-build --emptyOutDir`; cmux screenshoty (post-loop, controller).
