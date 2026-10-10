# GameOnVB: pop → karta → kutálení vlevo → delší pád → schody. Plán

> Pro Hermes: pouze návrh, žádná implementace nyní. Po dalším schválení jeden GPT-6.1 Sol Fast writer, rodič nezávisle ověřuje. Bez commit/push/deploy.

**Cíl:** zachovat přijatý pop, nechat tentýž míč dosednout na svou oranžovou kartu, odkutálet se doleva, přetočit přes levý spodní roh, delší dobu padat za současného odjezdu karet nahoru a dopadnout na horní schod.
**Architektura:** stávající renderer-owned `ball-presentation`, jeden živý ball model a RAF owner; jeden sampler konkrétní choreografie a jeden společný world→screen převod pro Three scénu a DOM karty. Žádný nový physics engine, router nebo animation framework.
**Stack:** stávající React, Three.js, DOM/CSS a `createBallFlow`.
**Stav:** doporučení po konzultaci s GPT-6-Astra a Claude Opus 5.5. Oba u prvního draftu požadovali změny, ty jsou níže zapracované. Není to tvrzení o druhém modelovém PASS ani schválení implementace uživatelem.

## 1. Výklad reference a současného problému

Reference: [uživatelův anotovaný screenshot](references/clipboard-2026-10-02-135805-6AA9B0FA.png). Barevné šipky jsou vodítka, ne prvky UI.

Míč má spodní částí dosednout do dolního pásu karty přibližně v úrovni štítku „Recreational volleyball“, ne středem proniknout do plochy a ne dosednout na separator jako na novou viditelnou polici. Pak se valí po skutečném sklonu směrem k levému spodnímu rohu. Měřit skutečnou transformaci, nepřebírat odhad úhlu ze screenshotu.

Dnešní `ballFlow.js:2-13` má 1.6s pád s konstantním x, bez kontaktní a rolling fáze. `ballScene.js:77-90` pozdě mění kameru a framing, `study.jsx:82-88` nezávisle přepočítává CSS matici a schovává deck opacity. Prodloužení konstanty by nepřidalo nové beaty ani skutečný odjezd karet nahoru. Mobilní finální plátno navíc pixeluje kvůli zvětšení malého padded source framebufferu (`ballScene.js:53-59`).

## 2. Doporučená choreografie, výchozí návrh 3.55 s

| Čas | Beat | Co musí divák skutečně vidět |
| --- | --- | --- |
| 0.00–0.30 s | Pop | Přijatý prostorový pop beze změny záměru. První frame navazuje na aktuální card pose a spin, karta zůstává viditelná. |
| 0.30–0.62 s | Dosednutí na kartu | Kontakt spodku míče s dolním páskem, jeden drobný odskok a měkký tmavší kontaktní stín. Žádná pauza před rozjezdem. |
| 0.62–1.70 s | Kutálení vlevo | Začne pomalu a zrychluje po sklonu. Panely se valí společně s uraženou dráhou, ne sklouzávají jako obrázek. Karta zatím drží polohu. |
| 1.70–1.85 s | Přetočení přes roh | Krátký čitelný oblouk kolem skutečného rohu, ztráta podpory a oddělení stínu. Není to stopka ani další rozjezd. |
| 1.85–3.10 s | Volný pád | Zachovaná výstupní rychlost, dolů a zpočátku vlevo. Celý vějíř odjíždí nahoru jako jeden celek, prostředí se proměňuje gradientem, schody se odhalují zespodu. |
| 3.10–3.55 s | Dopad na horní schod | Jeden menší odskok a dosednutí. Žádný automatický rozjezd po dalších schodech. |

Časy jsou první výtvarný pokus, ne hotový runtime výsledek. Začátek kutálení není lineární/ease-out přesun. Při corner beat nesmí výstupní rychlost spadnout na nulu. Na kartě se míč po dokončení popu dále nezvětšuje/nezmenšuje. Oddálení kamery patří až do pádu, nikoli jako náhlé zmenšení či zostření při dopadu.

## 3. Pinned technická rozhodnutí

### Kontakt a dráha

- Karta je DOM/CSS plocha, nikoli objemová Three karta. Použít jednu authored kontaktní dráhu z jejího skutečného lokálního pásu, měřených rohů a transformace. Nevyrábět druhou 3D kopii karty ani viditelný ledge.
- Při vstupu zachytit kontaktní oporu, tečnu, normálu, levý corner, skutečný aktuální poloměr a source pose. Radius zahrnuje uniform scale popu, ne pouze dnešní základní `dataset.diameter`.
- Střed kontaktujícího míče je `opora + normála × radius`. Ambient vertikální drift nesmí během kontaktu odtrhnout míč od opory. Roh se určuje ztrátou této podpory, ne AABB hranicí.
- Po ztrátě podpory použít jednu balistiku s navázanou rychlostí: `x = xe + vx*τ`, `y = ye + vy*τ - g*τ²/2`. Pro navrženou dobu pádu odvodit source-world ukotvení zpětně od existující horní plochy a výstupní rychlosti, takže koncový kontakt vyjde bez závěrečného ohnutí/snapu trajektorie. Ukotvení předem nesmí změnit první source-screen frame.
- Poloha je spojitá všude. Rychlost je spojitá na nekolizních spojích; fyzicky zamýšlené nárazy mohou změnit normálovou složku definovaným malým impulsem. Nevyžadovat falešnou C1 spojitost přes odraz.

### Orientace a hybnost

- Zachytit skutečnou orientaci ve všech osách a zbytkovou úhlovou rychlost. Běžné `ballMotion` používá yaw/pitch a časový roll sinus, ten sám pro valení nestačí.
- Použít úzký quaternionový stav pro tento entry, osu z normály a tečny a hlavní rolling úhel z uražené dráhy/radius. V projekci se při cestě vlevo míč valí proti směru hodinových ručiček, skutečný sign odvodit z rámce, ne natvrdo z world Euler.z.
- Zbytkový volný spin během krátkého kontaktu plynule převést do valení, ne vynulovat ani neomezeně přičítat ke kinematické rotaci. Po odjezdu navázat úhlovou rychlost, při zpátečním pohybu žádný návrat na počáteční Euler pose.
- Před obyčejným source `paint` při návratu předat úplnou aktuální orientaci do jeho kompatibilního základu. Nezměnit `brushSpin` impulsy, damping, sampling ani běžný card return pro celý web.
- Visible eligible přechod má stejné view/canvas/meshes/materials. Hidden/offsheet/reduced může nadále uvolnit GPU, jak dělá současný controller: logická orientace, clock a momentum musí přežít rekonstrukci. Neslibovat bezvýjimečně stejné GPU objekty i po disposal.

### Kamera a karty

- Společný čas sám nestačí. Během kontaktu držet orientaci kamery pevnou a DOM i Three pohyb odvozovat ze stejné projekce/source rámce. Afinní transform fan odvodit z této projekce, ne nezávislým easingem proti pohybu kamery.
- Po odjezdu se celý fan tří karet pohybuje vzhůru jako jedna kompozice, bez vzájemné paralaxy a bez opacity fade, dokud geometricky neopustí záběr. Krátký měkký náběh do téměř rovnoměrného posunu. Spodní hrana má zůstat čitelná ještě krátkou část prvního pádu, návrh přibližně 0.3 s.
- Další změnu orientace kamery vůči DOM kartám až po jejich odjezdu. Source paginaci a scroll nápovědu během kutálení potlačit jako vedlejší vizuály, při návratu přesně obnovit; dialogové Back/Escape funguje celou dobu.
- Vůči kartě a schodům se míč při air beat skutečně pohybuje dolů. Na obrazovce ho kamera může v druhé polovině pomalu dohánět, ne náhle vytáhnout vzhůru. Výchozí výtvarný limit: žádný rychlý upward sweep, souhrnný vzestup obrazu míče nejvýše přibližně čtvrtina viewportu.
- Navržené cílové rámování, nikoli redesign schodů: desktop míč přibližně 40 % zleva / 55 % shora; mobile blíž středu / 55–60 % shora. Nemá končit drobný u levého kraje v horní třetině jako nyní.
- Mobile framing začne plynule sledovat cestu už při dosednutí, pokud by levý roh jinak ztratil celý obrys míče. Stejný camera shift musí posunout i kartu, aby kontakt držel. Směr nemirrorovat, neřešit ztrátu jedním frame clampem. Kontrolovat celý obrys, ne jen střed.

### Canvas a ovládání

- Tentýž canvas během entry převést na viewportový backing-buffer a první obraz zachovat projekcí/ukotvením, ne velkým CSS roztažením padded source bitmapy. Resize musí ihned repaintovat aktuální pose. Žádný druhý canvas, model, poster ani enormní DPR násobek paddingu.
- Výchozí navržený rozpočet: DPR nejvýše současných 1.5, celkový backing-buffer nejvýše 4 MP. Při 1440×1000 je DPR1.5 3.24 MP, při 390×844 0.741 MP. Toto je navržená mez pro spike, nikoli změřená mobile performance.
- Zahrnout skutečnou resize/orientation změnu během entry, kterou současné `Volleyball.jsx:66` pro detail vynechává. Zachovat beat/clock/orientaci, ne restart celé sekvence.
- Přerušení reaguje příští frame z aktuálního stavu. Návrat může být svižnější než vstup, výchozí návrh asi 1.3 s z otevřeného detailu; návratový clock proto potřebuje plynule vyšší rychlost, ne současný limit 1. Karty jedou zase dolů, zdrojový inline transform a overflow se přesně obnoví.
- Zachovat serial hash handoff, source scroll/focus, repaint-before-close, hidden pause i paused reduced toggle, pending-import invalidaci a jediný RAF owner. Reduced motion cestu přeskočí a umístí tentýž míč na horní plochu; no-GPU zůstává exact-model preview.

## 4. Implementační pořadí až po schválení

Každý krok RED → minimální změna → GREEN. Žádné pohodlnostní commity ve WIP.

1. **Základ projekce a ostrost:** `ballScene.js`, `Volleyball.jsx`, `study.jsx`, `ballScene.test.mjs`. Nejprve failing test viewportového backing-bufferu, první source projekce, stejné identity a resize bez skoku. Potom úzká oprava téže prezentace; před delší choreografií native desktop/mobile kontrola source-frame parity. Nepřepisovat lifecycle/router.
2. **Konkrétní pohyb:** `ballFlow.js`, `ballFlow.test.mjs`, `ballScene.js`; entry orientační most v `Volleyball.jsx`, případně minimální kompatibilní rozšíření `ballMotion.js` jen pokud nutné. RED pro kontakt/radius, zrychlující rolling, corner support loss, navázanou freefall rychlost, quaternion a cílovou horní plochu. Nahradit starý konstantní-x invariant přesnými phase assertions, ne odstranit bounds. Controller pause/reverse/reduced invariants ponechat.
3. **Cards-up a gradient:** `study.jsx`, `study.css`, `ballEntryLifecycle.test.mjs`, `dialogHandoff.test.mjs`. RED pro pevnou kartu při kontaktu, celistvý up-travel z téže projekce po odjezdu, přesnou obnovu fan/deck stylu a přerušení v každém beatu. Potom synchronizace z jednoho sampleru. Goal Loop výtvarně beze změny.
4. **První výtvarná kontrola:** rodič, desktop 1440×1000 a mobile 390×844/320×780. Krátký native filmstrip od kliknutí přes kontakt, roll, roh a air beat po dosednutí, actual pose/velocity/card-transform/quaternion trace. Před rozšířením owner musí vidět, že se míč valí, karty jedou nahoru a mobil nepixeluje. Žádné generované video/still nahrazující mechaniku.
5. **Akceptace:** rozšířit `ball-flow.py`, potom níže uvedené regrese v rodiči. Review změnového delta, protected source hashes, pending frames/resources, cleanup task-owned browser tabs. Zapsat známé limity, fyzický telefon ověřit zvlášť.

## 5. Ověření a hranice

Budoucí build, server 5186 není HMR:
`./node_modules/.bin/vite build sketches/013-light-table --outDir /Users/vitek/.hermes/cache/scratch/light-table-build --emptyOutDir`

Budoucí gates, očekávání exit 0, nikoli vymyšlený počet testů:
`node --test sketches/013-light-table/*.test.mjs`
`npm run test`
`npm run check`

Native scripts: ball-flow.py, watch-flow.py, watch-reveal.py, scroll-continuity.py, watch-scroll.py, held-touch.py, card-actions.py, ball-return.py, ball-momentum.py, ball-parity.py, ball-3d.py, verify.py. Časové watch flakes rozlišit od regresí, ne oslabit limity. Explicitní příkazy dohledat ve stávajících README/WATCH-AND-SCROLL a scripts.

Browser: cmux v odděleném okně a pouze vlastní záložky pro vizuální kontrolu. Uživatel výslovně dovolil vlastní headless Chrome podle existujících Python skriptů pro časové stopy a native wheel/touch v rodiči; tato možnost zůstává. Screencast timestampy korelovat s actual state, screenshot threshold není přesný captured frame. Codex workspace-write sandbox neoslabovat kvůli browseru. Žádné další serverové porty pro staré studie.

Nyní se zapisuje jen tento plán a reference. Žádná nynější implementace, nové knihovny, viditelné šipky/ledge, scoring UI, motion blur/trails maskující pád, produkční přebarvení, redesign schodů/okolí ani integrace skutečných project routes. 5186 a potřebný 5181 zachovat; 5182–5184 neobnovovat. Nic nestashovat, neresetovat, necommitovat, nepushovat, nenasazovat.

## Konzultace a rozhodnutí rodiče

- **Astra, GPT-6-Astra:** první draft PLAN CHANGES. Zapracováno: actual support frame a scaled radius, plná quaternionová orientace/return bridge, skutečně společná projekce, konkrétní viewport buffer s pixel budgetem/resize, GPU-disposal výjimka a rychlejší návratový clock. Rodič potvrzuje výjimku spojitosti rychlosti na nárazech. Nedoporučené omezení proof na pouhé cmux místo povoleného parent Chrome nebylo převzato, odporuje výslovnému uživatelskému browser kontraktu.
- **Opus, ověřený canonical `claude-opus-5-5`:** první draft PLAN CHANGES. Zapracováno: zrychlující rolling, viditelný kontakt/stín, corner beat, pravidlo obrazového pádu, rigidní cards-up bez fade/paralaxy, dřívější mobile framing a 3.55s rytmus. Odhady úhlu/rozměrů ze screenshotu nejsou hardcoded hodnoty, skutečné rozměry se měří.
- **Rodič:** doporučuje výše uvedený rozsah. Výtvarná trajektorie má přednost před pouhým prodloužením timeru; minimalismus platí pro mechaniku implementace, ne zkrácení požadované scény. Source runtime nebyl v tomto planning kroku změněn. Implementace čeká na uživatelovo další schválení.
