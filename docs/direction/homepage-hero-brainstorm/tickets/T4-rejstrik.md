# T4 — Rejstřík (Vybraná práce) + textový detail SolidPixels (Sol)

Závisí na: T2, T0. Paralelně s T3, T5, T5a jen v nezávislém klonu.

## Smí měnit
`src/home/landing/work/` (komponenty, CSS, testy, náhledové obrázky).

## Specifikace
- Seznam: SolidPixels, GameOnVB, Screen Switch, Goal Loop (+ vedlejší odkaz Playground). Řádek: název, role, sólo/tým, věta příspěvku (z T0 / `projects.ts`). Odpovědnost čitelná bez hoveru.
- Výběr položky klikem, tapem nebo klávesnicí (šipky v seznamu, Enter). Hover jen zvýrazní řádek (barva/podtržení 140 ms), nic nemění.
- Výměna přílohy: jedna maska `clip-path`, 220 ms. Rám a text se nehýbou. Rychlé volby ruší předchozí přechod (žádná fronta).
- Sticky náhled jen na desktopu s výškou ≥ 760 px; jinak náhled pod vybraným řádkem.
- SolidPixels detail JEN TEXTEM (žádné screenshoty ani UI SolidPixels): kontext týmu, vlastní příspěvek oddělený od výsledku týmu, jeden příklad problém → změna → ověření (z T0). Rozbalení detailu = výměna obsahu bez dalšího pohybu.
- Screen Switch řádek má místo pro modul T5a (slot).
- Odkazy „View project“ jen u projektů s vlastní stránkou (`/gameonvb`, `/goal-loop`).
- Reduced-motion: výměna bez masky.

## Kritéria přijetí
- Test výběru: klávesnice, rušení přechodu při rychlé volbě, sticky podmínka podle výšky.
- Na 1440×900 jsou všechny položky vidět bez scrollu uvnitř sekce.
- Screenshoty: každý vybraný projekt (1440, 390), otevřený textový detail SolidPixels.

## Kontroly
`npm run check`, `npx vitest run src/home/landing/work`.
