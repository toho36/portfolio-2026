# Homepage hero: brainstorm (2026-10-09)

Stav: jen návrhy. Nic není vybrané ani schválené k implementaci. Produkční kód se neměnil. Lunární směr (023, koule z desek) je vyřazený a tady se neobjevuje.

## 0. Pozor: co je „současná homepage“

Zadání říká, že současný stav je poster slider. To platí jen pro poslední commit (`ed9df3c`). V pracovní kopii je necommitnutá jiná homepage: **Light Table** (`src/home/lightTable/`, Oct 3). Tři listy na tmavém stole (Goal Loop s 3D hodinkami, GameOnVB s 3D míčem, Intro). Scroll listy rozdává. Audit pokrývá obě verze.

Screenshoty (lokální vite, cmux, 1440×900 a 390×844):

- `audit/head-0.png`: commitnutý poster slider, úvodní poster.
- `audit/wip-0.png`: Light Table, první stav.
- `audit/wip-2.png`: Light Table, třetí list (Intro).
- `audit/wip-m.png`: Light Table, mobil 390 px.

## 1. Audit v 5 bodech

1. **Funguje: sdělení.** „New tools. Old standards.“ je krátké, seniorní a sedí na publikum (HR, hiring, tech lead). Jméno a role jsou hned čitelné v HTML. Tohle chci zachovat.
2. **Funguje: řemeslo Light Table.** Skutečný materiál (papír, tmavý stůl), vějíř a jeden pohyb (rozdání listu scrollem) působí prémiově. Statické fallbacky a reduced-motion jsou hotové a otestované.
3. **Nefunguje: hrdina neříká nic o mně.** První pohled v Light Table jsou hodinky („Precision, in motion.“). Návštěvník vidí produktový snímek hodinek, ne vývojáře. To, co dělám (CMS, frontend, backend, integrace, sólo i v týmu), se v prvním pohledu neobjeví. Poster slider má naopak silnou typografii, ale působí jako šablona: Helvetica na černé, prázdná pravá polovina, důkaz řemesla až po scrollu.
4. **Nefunguje: chyby a duplicity.** Nadpis „New tools. Old standards.“ je na Light Table dvakrát (vlevo nahoře i na třetím listu, `wip-2.png`). Na mobilu přetéká navigace přes nadpis a karta přesahuje pravý okraj (`wip-m.png`). Instrukce „Scroll to deal. Reverse to collect.“ je znak, že interakce není samozřejmá.
5. **Nefunguje: pohybový rozpočet.** Na jednom pohledu běží sledování kurzoru, naklánění listů, idle rotace míče a rozdávání scrollem. To jsou čtyři pohyby místo jednoho. Hero navíc nese plný Three.js renderer kvůli sdělení, které unese typografie.

Závěr: zachovat text a kvalitu materiálu. Změnit předmět hera (já a moje práce, ne hodinky) a snížit počet pohybů na jeden.

## 2. Koncepty

Společná pravidla pro všechny: jméno a role v HTML od prvního snímku, žádný loader, jeden hlavní pohyb na pohled, reduced-motion = finální kompozice bez pohybu, bez WebGL = stejný layout jako statický obrázek nebo čisté HTML. Slovo „AI“ v nadpisu ne.

### K1. Korektura (čistě typografický)

- **Co říká:** Dotahuju věci do konce, i ty, které začaly rychle.
- **Pohyb:** Nadpis „New tools. Old standards.“ se při načtení objeví jako hrubý sazební nátisk: špatný řez, nerovné mezery, korektorské značky na okraji. Během cca 1,2 s se sazba srovná do finální podoby (variabilní font: váha, šířka, prostrkání) a značky zmizí. Uživatel nic dělat nemusí. Po doběhnutí je klid.
- **Mobil:** Stejné. Dva řádky nadpisu, značky jen vpravo v okraji.
- **Riziko laciného dojmu:** Střední. Když přechod není přesný, vypadá jako chyba načtení fontu (FOUT). Musí být zjevně autorský: čitelné korektorské značky, jasný konec.
- **Pracnost:** S.

### K2. Rejstřík (editoriální, bez 3D)

- **Co říká:** Mám šíři práce a umím ji uspořádat.
- **Pohyb:** Hero je velký sazební obsah: jméno, krátká věta, pod ní 5 řádků (GameOnVB, SolidPixels, Goal Loop, Screen Switch, Playground) ve velkém serifu s rolí vpravo („Product / solo“, „CMS + client sites / team“…). Najetí na řádek vysune maskou jeden náhled projektu do volného sloupce. Jen jeden náhled naráz.
- **Mobil:** Seznam bez hoveru. Tap rozbalí řádek s náhledem pod ním (nativní `<details>`).
- **Riziko:** Vysoké, že bude vypadat jako běžná „hover list“ šablona. Pomůže jen výjimečná typografie a skutečné obrazy projektů.
- **Pracnost:** S–M.

### K3. Vrstvené listy (bez 3D, CSS)

- **Co říká:** Pracuju na více plochách naráz (CMS, web, aplikace) a držím je v jednom systému.
- **Pohyb:** Velké panely projektů se překrývají s posunem jako stoh listů. Scroll nebo drag přetáhne další panel přes předchozí s `clip-path` odhalením. Nadpis zůstane na místě a mění se maskovaným posunem řádku. Jediný pohyb: příchod dalšího panelu.
- **Mobil:** Svislý swipe. Panely na celou šířku, posun jen v ose y.
- **Riziko:** Vysoké, že to je jen hezčí poster slider. Musí mít jasný rozdíl: překrytí a hloubku papíru, ne střídání plných obrazovek.
- **Pracnost:** M.

### K4. Spára (2,5D materiál, WebGL plocha)

- **Co říká:** Solidní základ pod povrchem. Bere si to, co se líbilo na 020 (materiál, světlo, žhavá spára), ale bez koule.
- **Pohyb:** Celoobrazovková deska tmavého kamene s vyrytým jménem. Při načtení se přes desku jednou rozžhaví tenká spára a deska se v ní o kousek rozestoupí. Ve spáře je vidět nadpis. Pak spára chladne a zůstane jen jemná linka. Ukazatel jen posouvá tečné světlo po povrchu (doplněk, ne druhá animace).
- **Mobil:** Spára vodorovně v horní třetině. Světlo se neposouvá, jen jeden průchod při načtení.
- **Riziko:** Vysoké. Tmavý „luxusní“ kámen umí vypadat jako agenturní šablona nebo herní menu. Tematicky slabá vazba na software.
- **Pracnost:** L.

### K5. Rozložený pohled (3D)

- **Co říká:** Spojuju části (CMS, frontend, backend, integrace) do jedné funkční věci.
- **Pohyb:** Jeden přesně obrobený objekt (blok z několika dílů) se při načtení jednou složí do celku s krátkým zacvaknutím. Najetí na objekt ho jemně rozloží, popisky dílů se objeví v HTML vedle.
- **Mobil:** Objekt složený, rozložení na tap.
- **Riziko:** Vysoké. Doslovná metafora, popisky na dílech připomínají infografiku. Blízko Goal Loop „shape and hole“ metafory.
- **Pracnost:** L.

### K6. Rys → hotová sazba (bez 3D)

- **Co říká:** Nejdřív struktura, potom detail. Engineer, který rozumí i layoutu.
- **Pohyb:** Hero se objeví jako technický výkres layoutu: tenké mřížky, rámečky textových bloků, kóty v mono písmu. Za cca 1,5 s se rámečky „naplní“ finální sazbou a výkres zeslábne na jemnou mřížku v pozadí. Uživatel nic nedělá. Kóty volitelně znovu ukáže podržení klávesy nebo tlačítko „Show grid“ (ne hover).
- **Mobil:** Stejné, s mřížkou o 4 sloupcích.
- **Riziko:** Střední. Může působit jako „under construction“ nebo devtools klišé. Výkres musí být krásný sám o sobě.
- **Pracnost:** S–M.

### K7. Sám / v týmu (bez 3D)

- **Co říká:** Potvrzený fakt: pracuju samostatně i v týmech a obojí stejně dobře.
- **Pohyb:** Obrazovka rozdělená na dvě poloviny. Vlevo „Alone“: vlastní produkty (GameOnVB, Screen Switch). Vpravo „With a team“: SolidPixels (CMS, klientské weby, integrace). Uživatel táhne svislý dělič. Polovina se rozšíří a ukáže víc. Jediný pohyb je jeho tah.
- **Mobil:** Dělič je vodorovný, tah nahoru a dolů. Alternativně dvě záložky.
- **Riziko:** Střední až vysoké. Porovnávací slider je známý widget. Popisky „Alone / Team“ mohou znít neohrabaně.
- **Pracnost:** M.

### K8. Zaostření (typografický, bez 3D)

- **Co říká:** Nové nástroje jsou šum, dokud je nedržíš standardem.
- **Pohyb:** Při načtení je za nadpisem rozmazaná vrstva slov a tvarů (rozmazané úlomky projektů). Kamera „přeostří“: pozadí zůstane rozmazané, popředí s nadpisem a jménem se zaostří. Jednou a hotovo.
- **Mobil:** Stejné. Méně vrstev kvůli výkonu.
- **Riziko:** Střední. Blur je na mobilu drahý. Seznam nástrojů v pozadí by vypadal jako buzzword cloud, proto jen tvary a úlomky, ne názvy.
- **Pracnost:** S.

## 3. Inspirace (zdroje)

- Awwwards Portfolio a Typography kategorie, říjen 2026 (např. twks, Maria Vasilyeva, Odyssée by NIGHTJAR): https://www.awwwards.com/websites/portfolio/ , https://www.awwwards.com/websites/typography/ , https://www.awwwards.com/websites/minimal/
- By-Kin a Mat Voyce jako příklad zdrženlivosti a kinetické typografie: https://www.hontran.dev/blog/best-award-winning-websites-2026
- Variabilní fonty a kinetická sazba jako hero místo obrázku: https://www.fontfabric.com/blog/10-design-trends-shaping-the-visual-typographic-landscape-in-2026/ , https://elements.envato.com/learn/web-design-trends
- WebGL drag slider s deformací (G. Colombel): https://www.awwwards.com/inspiration/webgl-slider-drag-g-colombel-portfolio-2024

Zdroje jsou jen pro měřítko kvality. Neověřoval jsem výkon ani detail interakcí těchto webů. Nic nekopírovat.

## 4. Kritika Astry a zúžení

Astra: GPT-6 Astra, OpenAI Codex, read-only, high, exit 0, 61 s. Plné znění: `astra-review/REVIEW.md`, vstup `astra-review/PROMPT.md`, doklad `astra-review/receipt.json`.

Verdikty: K2 KEEP. K3, K6, K7 REWORK. K1, K4, K5, K8 DROP. Pořadí: K2, K3, K7.

Hlavní výtka k celému seznamu: většina konceptů je efekt při načtení, ne kompozice. Senioritu neprokáže materiál ani slogan. Prokáže ji přesně popsaný vlastní příspěvek a skutečná práce.

Doplněk k auditu od Astry:

- „Old standards“ lze číst i jako „zastaralé postupy“. Slogan potřebuje hned vedle sebe konkrétní oporu: co dělám a za co odpovídám. Změna textu je rozhodnutí majitele.
- „View project“ na listu s představením ukazuje, že strukturu řídí šablona karty, ne obsah.
- Statická varianta musí být plná kompozice, ne zastavená animace.

## 5. Zúžení na 3

1. **K2 Rejstřík.** Podmínka: bez hoveru je hned čitelné, co jsem udělal a jakou jsem měl odpovědnost. Náhled jen přidává hloubku. SolidPixels má plnou váhu.
2. **K3 Vrstvené listy.** Podmínka: první statický list sám představí vývojáře přes skutečnou práci. Žádné hodinky ani jiný symbol místo obsahu.
3. **K7 Sám / v týmu.** Podmínka: obě zkušenosti jsou čitelné bez tažení, i na mobilu. Netvrdit „obojí stejně dobře“.

Můj závěr: K7 nemá cenu jako widget s děličem. Má cenu jako obsahová osa. Proto ho slučuji do K2: rejstřík má sloupec „solo / team“ a u každého řádku vlastní odpovědnost. Zbývají tedy dvě skutečné možnosti:

- **Možnost A — Rejstřík (K2 + osa K7).** Bez 3D. Typografie a obsah nesou celý hero. Jediný pohyb: maskovaný náhled jednoho projektu. Pracnost S–M. Nejbezpečnější pro HR a tech leady. Riziko: šablonovitost, řeší se jen kvalitou sazby a textů.
- **Možnost B — Vrstvené listy (K3).** Zachová materiál a papír z Light Table, ale místo hodinek je na každém listu skutečný projekt a můj podíl. Jediný pohyb: příchod dalšího listu. Pracnost M. Víc „wow“, ale vyšší riziko, že bude vypadat jako opravený Light Table.

Doporučení: **A**. Nejrychleji řekne, kdo jsem a co umím. Nejméně se rozbije na mobilu. Pohyb má málo a přesně. Materiál z B lze později použít uvnitř náhledů.

Další krok po výběru: nová izolovaná studie v `sketches/025-…` se třemi statickými kompozicemi (desktop, mobil, reduced-motion) dřív než jakýkoli pohyb.
