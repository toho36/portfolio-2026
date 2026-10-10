# T0a — Podklady P1′ GameOnVB lifecycle (Claude/Sol, lokální VoleyEvents)

Závisí na: T0. Blokuje: T1, T3.

## Cíl
Skutečné výřezy lokálního GameOnVB (VoleyEvents) UI s demo daty pro 4 kroky a ověřené věty o tom, co dělá systém.

## Postup
1. Ověřit v kódu `/Users/vitek/main/GitHub/voleyevents` (read-only), co skutečně existuje:
   - vypsání opakovaného termínu s kapacitou;
   - veřejná registrace a změna obsazenosti;
   - **párování příchozí bankovní transakce s registrací** (existuje automatický mechanismus? jaký vstup? audit?);
   - uložení docházky.
   Výstup: `content/P1-FACTS.md` s odkazy `soubor:řádek` pro každé tvrzení.
2. Lokální dev instance s **jednorázovými QA demo daty** (stálá výjimka VoleyEvents: disposable QA data). Žádná produkční data, žádné skutečné osoby, žádný zápis do produkce.
3. Projít 4 kroky s **tímtéž termínem a tímtéž demo hráčem**. Krok 3 přes skutečný párovací mechanismus s demo vstupem banky. Pokud mechanismus neexistuje: krok 3 = správa plateb, bez slova „matched automatically“.
4. Screenshoty z cmux: desktop výřez + předem komponovaný mobilní výřez pro každý krok. Uložit do `content/p1-assets/`.
5. `content/P1-SCRIPT.md`: pro každý krok titulek, výřez, jedna věta „co dělá systém“, stav před/po. Štítky: „Reconstruction with demo data“, u kroku 3 „Simulated bank input“.

## Kritéria přijetí
- Každá věta v P1-SCRIPT má oporu v P1-FACTS (soubor:řádek).
- Všechny 4 výřezy ukazují stejný termín a stejného hráče.
- Žádná osobní data, žádné produkční zápisy. Úklid demo dat doložen.
- Majitel výřezy schválí.
