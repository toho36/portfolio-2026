# HorizonX — analýza a co si vzít (2026-10-10)

Zdroj: https://horizonx.so/ , https://horizonx.so/explore/velto , https://horizonx.so/collections/gsap-animations. Prohlédnuto přes headless Playwright (1440×900, scroll). Screenshoty: `~/Documents/agent-runs/portfolio-2026/2026-10-10-horizonx/`. Interakce ručně netestovány.

## Co to je

Placená knihovna (Pro ~$24.99/měsíc) UI kitů, šablon landing pages, GSAP animací, shaderů a WebGL komponent. Sama sebe nazývá „the premium UI & code library for the vibecoding era“. Má MCP pro Claude Code / Cursor / Codex. Většina položek je Premium — kód nekopírovat, jen principy.

## Co dělají dobře

1. **Obousměrné scroll animace (Velto).** Každá animace je navázaná na scroll (`scrub`) a při scrollu zpět se čistě vrátí. Žádné „jednou přehrát a hotovo“.
2. **Jeden silný motiv na sekci.** Apex Roadster: velký nadpis přes jednu fotku („Motion, reduced to its purest form“). LUMO: obří display písmo + jeden produkt.
3. **Editoriální serif + jeden objekt** (Aurel Liquid Hero): kurzívní serif, hodně prázdna, jeden 3D prvek.
4. **Pinned sekce s choreografií** (PULSO card-fan, scroll-scrubbed marquee).
5. Jen písmo Inter v UI webu samotného; hierarchie velikostí 14 / 17 / 40 / 56 px.

## Co si vzít pro portfolio

1. **Reverzibilita jako pravidlo.** Do T2 (motion systém) přidat: animace spojené se scrollem musí jít obousměrně (GSAP ScrollTrigger `scrub`, už nainstalovaný). Scroll zpět = čistý návrat, žádné přeskoky.
2. **Sekce „Jak pracuju“:** řada bran Goal Loop vykreslená scrollem (scrub, reverzibilní) místo jednorázového vykreslení. Je to jediný dominantní pohyb sekce.
3. **Velký nadpis přes jeden obraz** jako kompoziční vzor hera: headline + P1 panel jako jediný „objekt“ (už v plánu).

## Co si nebrat

- **Šablonový „vibecoding“ vzhled.** Tyto šablony vidí stovky lidí. Tech lead pozná template. Pro tvůj cíl (nepůsobit jako vibecoder) je riziko vyšší než u Frameru.
- **Card-fan s fotkami** — to už byla Light Table a homepage se od ní odklání.
- **Particle/shader pozadí, tunnel slidery** — porušují pravidlo jednoho pohybu; patří spíš na /playground.
- **Placený kód** — licence; stavět vlastní.

## Shrnutí

HorizonX ukazuje řemeslo pohybu (hlavně obousměrný scroll), ne strategii. Bereme jeden princip (reverzibilní scrubbed reveal, max. jeden na viewport) do T2 a T5. Vzhled šablon nekopírovat.
