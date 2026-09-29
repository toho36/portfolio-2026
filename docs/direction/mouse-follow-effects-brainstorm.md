# Mouse-follow efekty: brainstorm pro portfolio-2026 (2026-09-29)

> První verze (Astra) vznikla omylem nad repem slapwall. Tahle verze je přepsaná na skutečný kód portfolia. Z původní verze zůstávají jen obecná pravidla: guardy pro reduced-motion a coarse pointer, jeden rAF, animovat jen `transform`/`opacity`, `pointer-events: none`.

## 0. Co už existuje

| Místo | Efekt | Kód |
|---|---|---|
| Homepage | Kruhový kurzor 3.5rem s popiskem (`Drag` / `Open` / `Send` / `Switch`), sleduje myš 1:1 bez zpoždění | `src/pages/Home.tsx:188` (`moveCursor`), `.home-cursor` v `src/styles.css:1662` |
| Homepage | Magnetické CTA (`--mag-x`, `--mag-y`) | `.magnetic-cta` v `src/styles.css` |
| GameOnVB | Parallax hřiště za myší (±12 px / ±8 px) | `src/components/PlayableCourt.tsx:199` (`parallax`) |
| Playground | Myš = samotná hra (hot wire). Další efekt u kurzoru by rušil hratelnost. | `src/playground/wireRuntime.ts` |
| Goal Loop | Nic navíc | — |

Pravidlo vlastníka: homepage = málo pohybu, jeden fokusovaný pohyb na pohled. Playground smí být chaotický. Viz memory `motion-budget-per-page`.

Závěr: homepage už mouse-follow má. Nový druhý efekt tam porušuje motion budget. Lepší je vylepšit ten stávající.

## 1. Možnosti

| # | Co návštěvník vidí | Kde | Náklad | Riziko | Wow/řádek |
|---|---|---|---:|---|:---:|
| A | **Kurzor s setrvačností** — kruh dobíhá myš se zpožděním (lerp ~0.18), popisek zůstává | Homepage, stávající `.home-cursor` | ~15 JS | Nízké; žádný nový prvek | **5/5** |
| B | **Kurzor v barvě posteru** — okraj kruhu přebírá `accent` aktivního posteru, přechod 300 ms | Homepage, stávající `.home-cursor` | ~3 JS, 2 CSS | Nízké | **4/5** |
| C | **Kurzor roste nad odkazem** — nad `Open`/`Send` kruh `scale(1.4)`, nad `Drag` normální | Homepage | ~4 CSS | Nízké | 3/5 |
| D | **Parallax vizuálu posteru** — `.poster-visual` se posune max ±6 px proti myši | Homepage | ~12 JS, 2 CSS | Střední; druhý pohyb vedle slideru, proti motion budgetu | 3/5 |
| E | **Stopa za kurzorem ve hře** — krátký jiskřivý ocas za kurzorem na drátu | Playground | ~30 JS v `wireRuntime` | Střední; může zakrýt drát, zhorší čitelnost hry | 3/5 |
| F | **Tvar sleduje myš** — tvar v Goal Loop se jemně natočí k myši (max 4°) | Goal Loop | ~15 JS | Nízké až střední; scéna už má vlastní choreografii | 2/5 |

## 2. Doporučení

**A + B.** Obojí mění jen prvek, který už existuje. Žádná nová vrstva na homepage. Kurzor s setrvačností působí prémiově. Barva posteru propojí kurzor se sliderem.

C až F zatím ne. D a F přidávají druhý pohyb. E ruší hru.

## 3. Zadání pro A + B

- **`src/pages/Home.tsx` `moveCursor`:** jen uložit cíl `x`, `y` a popisek. Nezapisovat `transform` přímo.
- **Jeden rAF:** max jeden čekající callback. Krok: `pos += (target - pos) * 0.18`. Zapsat `translate3d(x, y, 0)`. Když je rozdíl pod 0.1 px, smyčku zastavit. Žádná trvalá smyčka.
- **První pohyb:** pozici nastavit rovnou na cíl, ať kruh neletí z rohu `0,0`.
- **Guard:** `matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)')`. Když neplatí, psát pozici 1:1 jako dnes. CSS už kurzor mimo tento media query skrývá.
- **Úklid:** při `mouseleave` a při unmountu zrušit čekající rAF. Při `document.hidden` smyčku zastavit.
- **B:** na `.home-cursor` nastavit `--cursor-accent` z `POSTERS[active].accent`. CSS: `border-color: var(--cursor-accent, var(--paper)); transition: border-color .3s, opacity .2s;`. Barvu textu nechat `--paper` kvůli kontrastu.
- **Neměnit:** `sliderController.ts`, popisky, `cursor: none` pravidla.

Kontrola: jeden malý test v `src/pages/homeCursor.test.ts`. Ověří, že `Home.tsx` volá `requestAnimationFrame` v cursor logice, používá `cancelAnimationFrame` a čte `accent`. Potom `npm run check`, `npm test`, `npm run build`. Vizuálně v cmux: kruh dobíhá, barva se mění po přepnutí posteru. Pozor: skryté okno cmux zastaví rAF (`visibilityState === "hidden"`).
