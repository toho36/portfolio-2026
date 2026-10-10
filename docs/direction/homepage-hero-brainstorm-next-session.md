# Nová session: brainstorm nového homepage hero

Pracuj v /Users/vitek/main/GitHub/portfolio-2026. Komunikuj česky, stručně. Tohle je jen brainstorming. Nic neimplementuj, nic necommituj, nic nedeployuj, dokud nevyberu směr a neschválím plán.

## Proč nový směr

Lunární studie (sketches/023-lunar-impact, Theia a vznik Měsíce) je odložená jako vedlejší projekt. Nejsem s ní spokojený. Měsíc dlouho vypadal jako fotbalový míč, deskový a dlaždicový vzor na kouli nefunguje. Tento směr znovu nenavrhuj. Nepoužívej kouli rozdělenou na desky, dlaždice ani buňky. Do 023 nesahej.

## Co platí pro homepage

- Je jednoduchá, minimalistická, s čistou strukturou.
- Animací je málo. Když se něco hýbe, dostane plnou pozornost. Každý pohled má jeden hlavní pohyb.
- Prémiové řemeslo na úrovni oceňovaných webů. Vítané jsou slidery a překrývající se layouty a přechody.
- Hravý chaos patří na /playground, ne na homepage.
- Současný stav: celoobrazovkový poster slider (5 posterů), sledování kurzoru a naklánění posterů ukazatelem (commity ed9df3c, f19a410).
- Publikum: HR, hiring manažeři a tech leadi. Musím působit jako zkušený engineer, ne jako „vibecoder“, ale zároveň jako člověk, který brzy přijímá nové nástroje.
- Tón: profesionální, zdrženlivý, seniorní. Žádné slovní hříčky. Slovo „AI“ nedávej do nadpisů.
- Potvrzený fakt: pracuji samostatně i v týmech. V SolidPixels dělám CMS, frontend, backend a integrace třetích stran.
- Mobil i desktop musí fungovat stejně dobře. Povinně: reduced-motion a statický fallback bez WebGL.

## Co si načti před návrhy

- docs/direction/radical-reset.md
- docs/direction/opening-brainstorm-and-astra-critique.md
- docs/direction/mouse-follow-effects-brainstorm.md
- docs/direction/storyboards.md
- src/pages/Home.tsx a src/home/
- Krátce sketches/020-lunar-art-finish/README.md. Jen abys pochopil, co se mi líbilo (materiál, světlo, žhavé spáry) a co ne. Nekopíruj ho.

## Co chci

1. Nejdřív si zjisti, co na současné homepage funguje a co ne. Napiš to v 5 bodech.
2. Navrhni 6 až 8 různých hero konceptů. Ke každému napiš:
   - jednu větu, co hero říká o mně,
   - hlavní pohyb a co na něj má uživatel udělat,
   - jak vypadá na mobilu,
   - riziko, že bude působit lacině nebo jako gimmick,
   - odhad pracnosti (S, M, L).
3. Aspoň 2 koncepty musí být bez 3D. Aspoň 1 musí být čistě typografický.
4. Pro inspiraci můžeš hledat online (oceňované portfolio weby, Awwwards, motion design). Uváděj zdroje. Nic neinstaluj.
5. Nech GPT-6 Astru (read-only, stejný runner jako v docs/direction/lunar-pro-motion-review/plan-review) kriticky posoudit tvůj seznam. Pak ho zúžíš na 3 nejlepší.
6. Na konci mi dej 2 až 3 možnosti, ke každé kontext pro rychlé rozhodnutí a svoje doporučení. Pak čekej na moji volbu.

Výstup ulož do docs/direction/homepage-hero-brainstorm/ (BRAINSTORM.md a review od Astry). Skici nebo prototypy dělej až po mém výběru a jako novou izolovanou studii v sketches/.
