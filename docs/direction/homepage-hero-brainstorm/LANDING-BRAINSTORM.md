# Homepage jako profi landing page: brainstorm v1 (2026-10-10)

Stav: jen brainstorm. Nic není schválené k implementaci. Vstupy: `BRAINSTORM.md` (doporučená možnost A Rejstřík), `astra-review/REVIEW.md`, `FRAMER-ANALYSIS.md`, Framer skills report (`~/Documents/agent-runs/portfolio-2026/2026-10-10-framer-skills/REPORT.md`).

Předpoklad: „landing page“ = homepage portfolia `/`. Ne landing page pro nový produkt.

## Cíl

Návštěvník (HR, hiring manager, tech lead) za 5 sekund ví: kdo jsem, co dělám (CMS, frontend, backend, integrace; sólo i v týmu), a vidí skutečnou práci. Za 30 sekund otevře relevantní projekt nebo kontakt. Stránka působí jako práce zkušeného engineera s prémiovým řemeslem.

## Napětí, které musí review rozhodnout

Majitel teď chce „animace, dynamické reagování“. Platné pravidlo (memory `motion-budget-per-page`): homepage klidná, jeden hlavní pohyb na pohled, když se něco hýbe, má plnou pozornost.

Návrh smíru: **jeden hlavní pohyb na viewport + reaktivní mikrostavy**. Mikrostav = reakce na přímou akci uživatele (hover, fokus, tah, scroll pozice), krátká (≤ 250 ms), bez vlastní smyčky. Nic se nehýbe samo kromě jednoho hlavního pohybu.

## Struktura stránky (6 sekcí)

1. **Hero.** Vlevo jméno, role, nadpis (cca 54–64 px, prostrkání −3 %), jedna věta s konkrétní odpovědností. Vpravo / pod tím **Proof panel**: rámeček se skutečnou prací v akci (viz níže). Hlavní pohyb: přehrávka v panelu.
2. **Rejstřík (sticky).** Vlevo seznam projektů ve velkém serifu, sticky během scrollu. Každý řádek: název, role, „solo / team“, rok nebo stav. Vpravo se při scrollu (desktop) nebo tapu (mobil) mění náhled aktivního projektu. Hlavní pohyb: výměna náhledu (maskované odhalení). Projekty: SolidPixels, GameOnVB, Goal Loop, Screen Switch, Playground.
3. **SolidPixels bento.** Mřížka 4–5 polí s reálnými kousky UI: CMS, frontend, backend, integrace třetích stran. Jen ověřená fakta a čísla. Hlavní pohyb: postupné „rozsvícení“ polí při vstupu do viewportu (jednou).
4. **Jak pracuju.** Goal Loop jako proces: plán → kritika → build → check → review → verdikt. Krátká horizontální sekvence se skutečnými kroky. Hlavní pohyb: token projde branami, jedna brána ho vrátí na opravu (už existuje `posterTimelines.ts` GOAL_*).
5. **Malé nástroje.** Screen Switch jako jedno interaktivní demo (už existuje komponenta). Hlavní pohyb: uživatelův klik.
6. **Kontakt.** Existující formulář (`ContactPoster`). Klid, žádný pohyb kromě stavů formuláře.

## Proof panel: varianty obsahu

- **P1 CMS → web.** Skriptovaná DOM přehrávka: úprava bloku v CMS, náhled, publikace, hotový web. Riziko: důvěrnost klientských dat; nutné vlastní demo data.
- **P2 Goal Loop.** Přehrávka skutečného běhu: brány, jedna chyba, oprava, PASS. Riziko: působí jako „AI tooling“, zvlášť bez kontextu.
- **P3 Kód ↔ výsledek.** Split: vlevo diff, vpravo živý render komponenty. Riziko: devtools klišé.

Doporučení: P1. Ukazuje hlavní práci (CMS + frontend + integrace) a nejlépe sedí na HR i tech leady.

Pravidla panelu: přehrávka je DOM (žádné video, žádný WebGL), max 12 s, pak klidový stav (ne nekonečná smyčka). Tlačítko Přehrát znovu. Hover pauzuje. Reduced-motion: rovnou finální stav. Mobil: panel na celou šířku, text čitelný (min. 12 px), ne zmenšený desktop.

## Motion systém

- Tokeny: `--ease-out: cubic-bezier(.16,1,.3,1)`, `--dur-micro: 180ms`, `--dur-reveal: 600ms`, `--dur-section: 900ms`.
- Knihovny: GSAP 3.15 je nainstalovaný (ScrollTrigger, SplitText, Flip v balíčku). Nic nového neinstalovat. Kde stačí CSS (`animation-timeline: view()`, View Transitions), použít CSS.
- Reaktivní mikrostavy: řádek rejstříku pod kurzorem se zvýrazní (barva = stav, jeden akcent), magnetické CTA (existuje), kurzor s popiskem (existuje, `cursorFollow.ts`) jen na desktopu s jemným pointerem.
- Zakázáno: idle animace, parallax pozadí, druhý pohyb vedle hlavního, auto-rotace 3D.
- Reduced-motion: všechny sekce ve finálním stavu, výměna náhledu bez pohybu.
- Bez WebGL: stránka WebGL nepotřebuje vůbec.

## Vizuál

- 2 písma: serif pro display (zatím Source Serif / stávající), grotesk pro text a UI.
- Pozadí papírově tmavé (stávající `--paper` / tmavý stůl z Light Table), ne čistá černá SaaS.
- Jeden akcent pro stav. Barvy projektů jen uvnitř náhledů.
- Rytmus sekcí: H2 vlevo, akce vpravo na stejném účaří (vzor z Frameru).

## Co se zahodí

Light Table hodinky a míč z homepage (zůstanou na stránkách projektů). Poster slider s celoobrazovkovými plakáty. Duplicitní nadpis. Instrukce „Scroll to deal“.

## Návrh ticketů (koncept, k review)

| ID | Ticket | Závisí na | Paralelně? |
|---|---|---|---|
| T0 | Obsah a fakta: texty sekcí, role u projektů, co smí do P1 (bez klientských dat). Majitel potvrdí. | — | ano (není kód) |
| T1 | Statická kompozice celé stránky v `sketches/025-landing/`: desktop 1440, mobil 390, reduced-motion. Bez pohybu. | T0 | ne |
| T2 | Design + motion tokeny, typografie, rytmus sekcí. | T1 | ne |
| T3 | Hero + Proof panel P1 (přehrávací engine, pauza, replay, reduced-motion). | T2 | ano s T4, T5 |
| T4 | Sticky rejstřík + výměna náhledů (desktop scroll, mobil tap). | T2 | ano s T3, T5 |
| T5 | SolidPixels bento + Jak pracuju (Goal Loop sekvence). | T2 | ano s T3, T4 |
| T6 | Integrace do `/`, odstranění Light Table z homepage, kontakt, navigace. | T3–T5 | ne |
| T7 | QA brána: a11y (klávesnice, fokus, kontrast), výkon (LCP, CLS, INP), mobil, reduced-motion, cmux screenshoty, nezávislé review. | T6 | ne |

Paralelismus: pravidlo „jeden writer na Git common directory“. Paralelní Sol workery proto buď (a) píšou jen do vlastních oddělených složek studie a parent je integruje sériově, nebo (b) běží sériově. Návrh: T3–T5 jako tři samostatné studie `sketches/025-landing/{hero,index,bento}/`, každý worker smí psát jen do své složky, integrace v T6.

## Otevřené otázky pro majitele

1. Smí P1 ukazovat SolidPixels CMS UI (skutečné rozhraní) s demo daty?
2. Zůstává nadpis „New tools. Old standards.“, nebo ho nahradit konkrétnější větou?
3. Mají být tickety v Hermes Kanban, nebo jen jako soubory?
