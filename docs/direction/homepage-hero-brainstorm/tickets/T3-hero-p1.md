# T3 — Hero + Proof panel P1′ GameOnVB lifecycle (Sol)

Závisí na: T2, T0a. Paralelně s T4, T5, T5a jen v nezávislém klonu.

## Smí měnit
`src/home/landing/hero/` (komponenty, CSS, testy, assety zkopírované z `content/p1-assets/`).

## Specifikace
- Hero: jméno, role, headline a věta z T0, odkazy „Work“ a „Contact“, panel P1′.
- P1′ = 4 kroky z `content/P1-SCRIPT.md`: Event opens, Player registers, Payment matched, Attendance resolved. Tentýž termín a hráč ve všech krocích.
- Kroky jsou přímo volitelné (tablist, šipky, Enter). Výchozí stav = krok 1, staticky, bez autoplay.
- „Play“ spustí krátký průchod (každý krok min. 2,5 s na čtení, přechod 240 ms). Pause / Resume / Replay jako skutečná tlačítka. Konec = čitelný souhrn všech 4 kroků.
- Každý krok: skutečný výřez + jedna věta „co dělá systém“ + stav před/po. Změněný prvek zvýrazní úzká linka. Žádný falešný kurzor ani psaní.
- Trvalý štítek „Reconstruction with demo data“; krok 3 navíc „Simulated bank input“.
- `aria-live`: „Step 2 of 4: Player registers“.
- Registrace do `createDominantMotion` (id `p1`). Opuštění viewportu = pauza.
- Reduced-motion: přepínání kroků bez přechodu, Play = jen přepnutí po krocích bez animace.
- Mobil: panel na celou šířku, předem komponované výřezy, text min. 12 px.
- Chybějící obrázek: textový popis kroku, ne prázdný rám.
- Záloha, pokud 4 kroky nebudou čitelné (rozhodne review T1): statická dvojice registrace → spárovaná platba.

## Kritéria přijetí
- Test stavového automatu: idle → playing → paused → playing → done; přímý výběr kroku během přehrávání zastaví průchod; replay; cancel od jiného dominantního pohybu.
- Časová osa z cmux: kroky v plánovaných časech ±50 ms, po skončení žádný rAF.
- Screenshoty 1440 a 390 ve všech 4 krocích.

## Kontroly
`npm run check`, `npx vitest run src/home/landing/hero`.
