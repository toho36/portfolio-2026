**CHANGES_REQUIRED.** Základ je kultivovaný: dobrá typografická hierarchie, klidná paleta, přehledný rejstřík a správná dominance SolidPixels. H1 60/41 px funguje. Prémiovou úroveň zatím sráží nedotažený důkaz produktu: desktop ukazuje nečitelnou administraci, mobil nahodilý ořez. Právě přesná prezentace vlastní práce má dodat osobitost jinak poměrně známé kombinaci serifů a dělicích linek.

Čtyři celky, textová odpovědnost, přímý kontakt a otevřený detail odpovídají T1. Rejstřík se podle screenshotu po vstupu do sekce vejde do 1440×900. Mobilní overflow porušuje explicitní akceptaci. Hodnotím dodané screenshoty, zdrojové podklady a kód; měření parenta jsem samostatně neopakoval.

**Blokující opravy — před T2:**

1. **Opravit geometrii mobilního panelu.** V [landing.css:124](/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-10-landing-t1/wt/src/home/landing/landing.css:124) reset `.landing-page :is(...figure...)` přebíjí `margin-inline: -20px`. Panel proto začíná na x=20 a končí mimo viewport. Použít například `.landing-page .landing-proof` pro mobilní přepis; zachovat šířku `calc(100% + 40px)`. Cíl: panel x=0 až šířka viewportu, obsah odsazený 20 px, **scrollWidth = clientWidth** na všech pěti rozměrech. Nepřekrývat chybu globálním `overflow-x:hidden`.

2. **Zvětšit desktopový důkaz koncového stavu.** V `.landing-proof-image` a `assets/step4-crop.png` nahradit celkový přehled cíleným výřezem účastníka a výsledku. Současných 2048 zdrojových pixelů se vměstnává přibližně do 596 CSS px; rozhodující text je mikroskopický. Cíl: **jméno, „Spárováno“, „Dorazil“ nejméně 12 CSS px, ideálně 14 px**, čitelné při 100% zoomu také na 1280 a 768. Vynechat hledání, filtry a nerelevantní administrativní ovládání.

3. **Nahradit mobilní posun skutečně komponovaným výřezem.** V [landing.css:128](/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-10-landing-t1/wt/src/home/landing/landing.css:128) odstranit závislost na `width:max(100%,390px)` a `translateY(-54%)`. Připravit výřez pro dostupných **350/280 px** při viewportu 390/320. Cíl: celé jméno a oba rozhodující stavy, text ≥12 px; rám přibližně **220–280 px vysoký**, podle obsahu. Destruktivní tlačítko „Odebrat“ nemá dominovat důkazu docházky.

**Neblokující zlepšení:**

- V `LandingPage.tsx` ponechat **jeden** Playground odkaz; doporučuji spodní řádek společně s vysvětlením hry.
- Desktopový eyebrow zkrátit na roli; na mobilu zachovat roli, protože v hlavičce chybí. Opakování celého jména nepřidává informaci.
- Pomlčka u Goal Loop **odpovídá COPY.md**, není implementační chyba. Raději skrýt prázdnou roli než vymýšlet nové tvrzení.
- SolidPixels opakuje stejný rozsah práce několikrát. Při další obsahové revizi zkrátit opakování; chybějící zveřejnitelný příklad není blokér T1, protože COPY výslovně dovoluje jeho vynechání.

**P1: věrohodný původ, nedostatečně čitelná prezentace.** P1-FACTS a P1-SCRIPT dokládají skutečný mechanismus; oba štítky jsou správně přítomné. Screenshot s uzavřenou „Historií (2)“ však sám neukazuje auditní záznam. Popisek vysvětluje děj, ale nenahrazuje čitelný důkaz.

Doporučené výřezy pro následné kroky T3; T1 potřebuje pouze kvalitní krok 4:

| Krok | Desktop | Mobil |
|---|---|---|
| 1 — Event opens | Řádek termínu: název, datum, kapacita 12, Otevřeno; bez navigace a správy. | Horní část skutečné karty termínu, bez akčních tlačítek. |
| 2 — Player registers | Dva jasně oddělené výřezy: obsazenost 1/12 a rezervace Demo Player. | Tytéž detaily nad sebou; nezmenšovat celou dlouhou stránku ani QR. |
| 3 — Payment matched | Transakce: DEMO PLAYER, 150 Kč, VS, Spárovaná; návaznost na registraci. | Úzké samostatné výřezy údajů; dodaný „mobile“ asset stále obsahuje široký layout. |
| 4 — Attendance resolved | Demo Player + Spárováno + Dorazil; případně samostatný detail počítadla nebo auditu. | Stejná identita a stavy; na 320 případně dva výřezy nad sebou. |

Měřítko všech kroků určovat podle výsledné čitelnosti **12–14 CSS px**, nikoli procenta celé obrazovky.

```json
{"verdict":"CHANGES_REQUIRED","blocking":["B1: Opravit specificitu mobilního marginu panelu; nulový overflow na všech viewports.","B2: Zvětšit desktopový výřez kroku 4; rozhodující text alespoň 12 CSS px.","B3: Nahradit mobilní procentní posun komponovaným výřezem pro 350/280 px bez ořezu stavů."],"nonblocking":["Ponechat jeden Playground odkaz.","Omezit opakování jména v eyebrow.","Skrýt prázdnou roli Goal Loop.","Při obsahové revizi zkrátit opakování v SolidPixels."]}
```