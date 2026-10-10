# framer.com: analýza a co si vzít (2026-10-10)

Zdroj: https://www.framer.com/ , prohlédnuto v cmux, 1440×900 a 390×844. Screenshoty: `~/Documents/agent-runs/portfolio-2026/2026-10-10-framer-analysis/`.

Limit: okno cmux bylo skryté (`visibilityState = hidden`). Část líně načítaných sekcí se nevykreslila (např. „Shipped with Framer“). Interakce a výkon jsem netestoval.

## Co Framer dělá

1. **Hero = věta + 2 tlačítka + jeden velký panel s produktem v akci.** Panel není video ani obrázek. Je to DOM přehrávka skutečného UI (agent píše plán, staví stránku, časovač 0:36). Ukazuje práci, ne slib.
2. **Zdrženlivá typografie.** Jen 2 písma. Nadpisy GT Walsheim Medium, 54 px (H1) a 44 px (H2), prostrkání −4 %, řádkování 1,0–1,1. Text Inter 18 px. Žádný obří nadpis přes celou obrazovku.
3. **Barva = stav.** Černé pozadí, šedé texty. Jediný akcent (elektrická modř se září) má jen aktivní nebo vybraný prvek. Barva neslouží jako dekorace.
4. **Pevný rytmus sekcí.** Nadpis H2 vlevo, jedno tlačítko vpravo na stejné účaří, pod tím karta. Opakuje se to v celé stránce. Karty mají rádius 18–25 px a tenký rámeček.
5. **Jeden sticky prvek.** Panel agenta vpravo zůstává na místě, zatímco vlevo se mění karty (Design, CMS, Code). Jeden stálý prvek drží několik sekcí pohromadě.
6. **Bento z důkazů.** Sekce „Not just vibes, a full platform“ je mřížka skutečných kousků UI: Core Web Vitals (LCP 1.1s, INP 95ms, CLS 0.01), CMS kolekce, větve, 99.99% uptime. Důkaz má podobu UI, ne ilustrace.
7. **Pohyb žije uvnitř rámečků.** Stránka sama je klidná. Pohybují se jen přehrávky a smyčková videa (autoplay, muted, loop) uvnitř karet.
8. **Mobil.** Stejné pořadí, jeden sloupec. Hero panel se jen zmenší. Text v něm je pak nečitelný. To je slabina.

## Co si vzít pro portfolio (pasuje na možnost A, Rejstřík)

1. **Panel „práce v akci“ pod nadpisem.** Jeden rámeček se skutečnou ukázkou práce. Například krátká přehrávka: úprava v CMS → publikovaný web, nebo Goal Loop brány. Tento panel je ten jediný pohyb na pohledu. Odpovídá výtce Astry: důkaz místo sloganu.
2. **Sticky rejstřík.** Seznam projektů zůstane vlevo na místě. Vpravo se mění náhled projektu. To je přesně struktura K2 a Framer ukazuje, že funguje.
3. **Typografie v menší velikosti.** Nadpis kolem 54 px s prostrkáním −3 až −4 %, ne 140px Helvetica. Dvě písma. Seniorní dojem dělá klid, ne velikost.
4. **Barva jen pro stav.** Jeden akcent jen pro aktivní řádek rejstříku a fokus. Nic víc.
5. **Rytmus „nadpis vlevo, akce vpravo“.** Jednoduchá šablona sekce, která se opakuje. Snadné udržet.
6. **Malé bento pro SolidPixels.** Kousky skutečného UI: CMS, frontend, backend, integrace. Čísla jen ověřená. Žádná vymyšlená metrika.

## Co si nebrat

- **Černý SaaS vzhled s modrou září.** Dnes vypadá jako každý AI produkt. Pro tebe je to riziko „vibecoder“ dojmu.
- **Zeď log.** Žádná loga klientů bez potvrzení faktů.
- **Několik videí naráz.** Porušuje pravidlo jednoho pohybu na pohled.
- **Slovník „agent“, „vibes“.** Do nadpisů ne.
- **Zmenšený hero panel na mobilu.** Mobil potřebuje vlastní kompozici: panel na celou šířku, větší text, nebo statický snímek s popiskem.

## Shrnutí

Framer nevyhrává efektem. Vyhrává tím, že ukazuje produkt při práci v klidném a přísném rámu. Pro portfolio z toho plyne: rejstřík (struktura) + jeden panel se skutečnou prací (pohyb) + zdrženlivá sazba. Podporuje to doporučení možnosti A.
