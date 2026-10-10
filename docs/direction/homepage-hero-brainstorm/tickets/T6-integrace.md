# T6 — Integrace do `/` a routing (Sol, sériově)

Závisí na: T3, T4, T5, T5a (každý prošel vlastními kontrolami). Blokuje: T7.

## Smí měnit
`src/pages/Home.tsx`, `src/App.tsx`, `src/styles.css` nebo nový `src/home/landing/`, odpovídající testy v `src/`. Moduly v `src/home/landing/` jen zapojit (už jsou v src).

## Specifikace
- `/` vykresluje novou landing page. Light Table zůstává pro `/gameonvb` a `/goal-loop` (dnes je `LightTable` sdílená pro všechny tři trasy v `src/App.tsx` kolem ř. 225).
- Přechody `/` ↔ `/gameonvb` a `/` ↔ `/goal-loop` fungují (zpět, historie, hash `#introduction`, `#contact`).
- Odstranit z homepage: duplicitní nadpis, „Scroll to deal“, cursor follow a tilt, pokud porušují pravidla pohybu (cursorFollow jen pokud nesoupeří s dominantním pohybem — jinak vypnout na `/`).
- Header: na mobilu nesmí překrývat obsah.
- Necommitnutou práci majitele mimo povolené soubory neměnit.

## Kritéria přijetí
- `npm test` a `npm run build` zelené. Existující testy tras a kontaktu procházejí; testy vázané na starou homepage upravit jen tam, kde je změna záměrná (vypsat v RESULT.md).
- Ruční průchod v cmux: vstup na `/`, otevření GameOnVB a Goal Loop, návrat zpět, kontakt přes hash.
- Žádné chyby v konzoli.

## Kontroly
`npm run check`, `npm test`, `npm run build`.
