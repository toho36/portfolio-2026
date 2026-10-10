# T5a — Screen Switch adaptace (Sol)

Závisí na: T2. Paralelně s T3, T4, T5 jen v nezávislém klonu.

## Smí měnit
`src/home/landing/switch/` (komponenta, CSS, test). `src/pages/Home.tsx` `ScreenSwitch` jen číst a importovat nebo zkopírovat markup.

## Specifikace
- Demo do slotu v Rejstříku (T4). Dva displeje, dvě okna.
- Klik / Enter / Space přesune obě okna současně za 280 ms. Bez odskoku, bez dodatečného blikání.
- Koncový stav stabilní + `aria-live` oznámení (existující text z `ScreenSwitch`).
- Viditelný štítek „Illustration of the feature“ — nejde o běžící macOS aplikaci.
- Registrace do `createDominantMotion` (id `switch`).
- Reduced-motion: okamžité přepnutí.
- Mobil: displeje pod sebou nebo zmenšené, tap.

## Kritéria přijetí
- Test: přepnutí, opakované rychlé kliky nevytvoří frontu, reduced-motion.
- Časová osa z cmux: obě okna začínají i končí ve stejném snímku ±1 frame.

## Kontroly
`npm run check`, `npx vitest run src/home/landing/switch`.
