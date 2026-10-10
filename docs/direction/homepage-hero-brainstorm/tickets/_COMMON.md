# Společná pravidla pro všechny tickety (T1–T7)

Platí pro každého Sol workera. Ticket je může jen zúžit, ne rozšířit.

## Autorita a hranice
- Žádný commit, push, deploy, instalace balíčků, spouštění dalších agentů.
- Psát jen do souborů uvedených v ticketu v části „Smí měnit“. Vše ostatní read-only.
- Necommitnutá práce majitele v repu (Light Table, sketches 009–024) se nesmí měnit, mazat ani stashovat.
- Do `sketches/023-lunar-impact/` a ostatních lunárních studií nesahat.
- Jen ověřená fakta: `src/content/projects.ts`, `src/content/homePosters.ts`, memory `portfolio-copy-facts`. Žádné vymyšlené metriky, klienti ani loga.
- Slovo „AI“ v nadpisech ne. Tón profesionální, zdrženlivý.

## Pravidla pohybu
- Ve viditelné ploše nejvýše jedna dominantní animace. Vedle ní jen lokální odezva ovládání (fokus, podtržení, barva; 120–160 ms).
- Nic se nehýbe samo. Dominantní pohyb spouští akce uživatele, nebo jednorázový vstup do viewportu.
- Nová akce ukončí předchozí dominantní pohyb (žádné fronty).
- Mimo viewport a při `document.hidden` se nepřehrává nic. Žádná trvalá rAF smyčka.
- Animovat jen `transform`, `opacity`, `clip-path`.
- Zakázáno: magnetické tlačítko souběžně s jiným pohybem, popisek pronásledující kurzor, tilt karet, falešné psaní, idle animace, parallax.
- `prefers-reduced-motion: reduce`: přímé přepnutí mezi úplnými stavy, nulové přechody.
- WebGL se nepoužívá.
- Knihovny: jen nainstalované (React 19, GSAP 3.15 vč. ScrollTrigger/Flip/SplitText). Kde stačí CSS, použít CSS.

## Přístupnost
- Vše ovladatelné klávesnicí; viditelný fokus; logické pořadí.
- Kontrast textu min. 4.5:1 (velký text 3:1).
- Stav přehrávání a výměny obsahu oznámit přes `aria-live="polite"`, kde to dává smysl.
- Obsah je v HTML, ne v obrázku nebo canvasu.

## Viewporty pro kontrolu
1440×900, 1280×720 (nízký desktop), 768×1024, 390×844, 320×640.

## Umístění kódu
Moduly žijí v `src/home/landing/<modul>/` (jen tam je čte `npm run check` a vitest `src/**/*.test.ts`). `sketches/025-landing/` je jen náhledový harness. Až T6 je připojí na `/`.

## Kontroly (vždy)
- `npm run check`
- `npx vitest run <relevantní testy ticketu>`
- Integrační tickety (T6, T7) navíc: `npm test` a `npm run build`.
- Každá netriviální logika (stavový automat, časování, výběr) má aspoň jeden malý test.

## Důkazy
- Screenshoty z cmux (ne Chrome CDP) do run složky ticketu: `~/Documents/agent-runs/portfolio-2026/<datum>-landing-<ticket>/`.
- Pozor: skryté cmux okno má `document.visibilityState === "hidden"` a rAF stojí. Před hodnocením pohybu to ověř.
- Screenshot pohyb neověří: pro pohyb zapiš časovou osu stavů (eval s `performance.now()` a stavem) nebo krátký screencast.
- Na konci `RESULT.md`: co se změnilo (seznam souborů), výsledky kontrol (výstup), co NEbylo ověřeno.

## Hotovo znamená
Všechna kritéria přijetí ticketu splněná a doložená. Report workera není důkaz; parent ověří diff a kontroly sám.
