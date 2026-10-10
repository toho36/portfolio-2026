# Homepage landing page: plán v2 po review Astry (2026-10-10)

Stav: brainstorm uzavřený, implementace NEschválená. Vstupy: `LANDING-BRAINSTORM.md` (v1), `astra-landing-review/REVIEW.md` (GPT-6 Astra, read-only, exit 0, 115 s). Tickety: `tickets/`.

## Co se změnilo proti v1 (podle Astry)

- **4 celky místo 6.** Hero, Vybraná práce (Rejstřík), Jak pracuju, Kontakt. Bento SolidPixels zrušeno, SolidPixels dostane rozšířený detail přímo v Rejstříku. Screen Switch demo patří do detailu své položky. Playground jen vedlejší odkaz.
- **Přesnější pravidlo pohybu:** ve viditelné ploše nejvýše jedna dominantní animace. Vedle ní jen lokální odezva ovládání (fokus, podtržení, barva, 120–160 ms). Nová akce ukončí předchozí dominantní pohyb. Mimo viewport a ve skrytém dokumentu se nic nepřehrává. Globální token 900 ms zrušen; délka patří ději.
- **P1 se spouští tlačítkem**, ne sám. Ovladatelné Pauza / Pokračovat (hover pauza nestačí).
- **P1 musí být poctivý:** skutečné CMS rozhraní s povolenými demo daty, jedna identifikovatelná změna, tentýž obsah v náhledu i na webu, popisek „co dělal Vítek / co tým“, štítek „rekonstrukce postupu s demo daty“. Samotná změna obsahu nedokazuje backend ani integrace.
- **Zakázané „laciné“ reakce:** magnetické tlačítko souběžně s náhledem, popisek pronásledující kurzor, naklánění karet, falešné psaní, postupné rozsvěcení celé mřížky.
- **Paralelismus:** oddělené složky ani běžné worktrees neplatí (sdílí Git common directory). Paralelně psát jen v **nezávislých klonech** (`git clone --local`, vlastní common directory) a integrovat sériově. Čtení a review mohou běžet paralelně vždy.
- **T6 musí řešit routing:** `src/App.tsx` sdílí `LightTable` pro `/`, `/gameonvb`, `/goal-loop`. Výměna `Home.tsx` nestačí.

## Struktura stránky

1. **Hero.** Jméno, role, jedna věta konkrétní odpovědnosti, P1 panel, odkazy „Práce“ a „Kontakt“. Slogan „New tools. Old standards.“ jen jako vedlejší věta (rozhodne majitel).
2. **Vybraná práce (Rejstřík).** SolidPixels (největší váha, rozšířený detail), GameOnVB, Screen Switch (s demem), Goal Loop. Playground jako vedlejší odkaz. Všechny projekty viditelné bez dlouhého scrollu. Sticky náhled jen na dostatečně vysokém desktopu.
3. **Jak pracuju.** Krátký odstavec: sólo i tým, rozhodování, ověřování. Goal Loop jako jeden doložitelný příklad.
4. **Kontakt.** Existující formulář, e-mail, CV.

Obsah projektů už existuje v `src/content/projects.ts` (`role`, `constraint`, `decision`, `evidence`). Rejstřík ho použije.

## 4 autorské momenty (z review)

| Moment | Spouštěč | Délka | Koncový stav |
|---|---|---|---|
| CMS → web (P1) | tlačítko „Přehrát postup“ | ~6 s, přechody 240 ms | čitelný výsledek + popisek změny, bez falešného kurzoru |
| Výměna přílohy v Rejstříku | klik / tap / klávesnice | 220 ms, jedna maska | jeden náhled + trvale čitelná odpovědnost; rychlé volby ruší předchozí přechod |
| Detail SolidPixels | aktivace popisku části UI | 260 ms | zvětšený skutečný výřez v pevném rámu + vysvětlení příspěvku; mobil má vlastní výřez |
| Screen Switch | klik | 280 ms, obě okna naráz | stabilní rozložení + textové oznámení, štítek „ilustrace funkce“ |

Reduced-motion: přímé přepnutí mezi obsahově úplnými stavy. Nic z toho nepotřebuje WebGL.

## Tickety a pořadí

```
T0 obsah ─► T0a podklady P1 ─► T1 statická kompozice ─► T2 tokeny + rozhraní
                                                         ├─► T3 Hero + P1
                                                         ├─► T4 Rejstřík + detail SolidPixels
                                                         ├─► T5 Jak pracuju + Kontakt
                                                         └─► T5a Screen Switch adaptace
                                          T3,T4,T5,T5a ─► T6 integrace + routing ─► T7 QA brána
```

T0, T0a: majitel (obsah, povolení, podklady). T1–T7: Sol worker, každý ticket zvlášť.
T3, T4, T5, T5a: smí běžet paralelně jen v nezávislých klonech. Jinak sériově.

## Blokery u majitele (před T0a)

1. Smí P1 ukazovat skutečné SolidPixels CMS rozhraní s demo daty? (povolení zaměstnavatele)
2. Jaké podklady doloží backend a integrace? (bez nich je jen v textu, ne v důkazu)
3. Zůstává slogan „New tools. Old standards.“?
4. Tickety do Hermes Kanban, nebo jen soubory?

## Top 5 rizik (Astra)

1. Inscenované důkazy a nejasně připsané zásluhy.
2. Opakování obsahu odsune projekty a kontakt.
3. Souběžné animace schované pod „mikrostavy“.
4. Mobil jako zmenšený desktop (CMS, sticky rejstřík).
5. Konflikty agentů a regrese sdílených tras při integraci.

## Rozhodnutí majitele (2026-10-10) a druhé review Astry

Majitel: (1) SolidPixels CMS UI se NESMÍ ukázat vůbec. (2) Backend doloží GameOnVB. (3) Slogan lze nahradit. (4) Tickety do Hermes Kanban, vše potřebné.

Astra (`astra-p1-slogan-review/REVIEW.md`, GPT-6 Astra, read-only, exit 0, 76 s): P1′ GameOnVB = REWORK a použít. Headline b → f → e.

Změny plánu:
- **P1′ GameOnVB lifecycle** místo „CMS → web“. 4 kroky, tentýž termín a tentýž demo hráč: (1) uložený otevřený termín s kapacitou a opakováním, (2) potvrzená veřejná registrace + změna obsazenosti, (3) příchozí transakce spárovaná s registrací (stav před/po, audit) se štítkem „Simulated bank input“, (4) uložená docházka téhož hráče. Trvalý štítek „Reconstruction with demo data“.
- Krok 3 jen pokud párovací mechanismus v kódu opravdu existuje. Ruční přepnutí „zaplaceno“ se nesmí vydávat za párování. Jinak tvrzení zúžit na správu plateb.
- Kroky jsou **přímo volitelné** (4 tlačítka / taby). Tlačítko „Play“ spustí krátký průchod, Pauza/Pokračovat, konec = čitelný souhrn. Ne 6 s nucené sekvence.
- Záložní varianta, pokud 4 kroky nebudou čitelné: statická dvojice veřejná registrace → spárovaná platba; celý průchod v detailu projektu.
- **SolidPixels jen textem**: kontext týmu, vlastní příspěvek (frontend, backend, integrace) oddělený od výsledku týmu, jeden zveřejnitelný příklad problém → změna → ověření, bez metrik. Moment „Detail SolidPixels“ (zoom UI) zrušen.
- **Hero text (doporučení Astry, čeká na potvrzení majitele v T0):**
  - Hoang Viet To / Software Developer
  - **I build web platforms and the systems behind them.**
  - At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product.
- Alternativy: „Production web software, from interface to integration.“ / „Full-stack web development, alone or in a team.“
