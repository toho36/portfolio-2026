# Framer: služba, docs a skills — co si vzít (2026-10-10)

## Co Framer prodává

Framer je no-code web builder (canvas + CMS + hosting). Od verze 3.0 (16. 6. 2026) se prodává jako „design agent“:

- **Agent v editoru**: navrhuje a upravuje stránky, CMS, kód.
- **Skills** (od konce 9/2026): uživatel uloží pravidla projektu (design system, tón, review). Volají se jako `/název` nebo je agent vybere sám.
- **External Agents**: `npx @framer/agent setup` nainstaluje CLI a 2 skills do `~/.claude/skills` a `~/.agents/skills`. Claude Code, Codex nebo Cursor pak upravují projekt bez otevřeného editoru.
- **Server API** (2/2026): headless přístup k projektu (CMS, publikace, canvas přes agent DSL).
- Dev docs: Plugins, Fetch, Code Components, Code Overrides, Server API, External Agents.

## Co je v balíčku `@framer/agent` 0.0.46

Přečteno z npm tarballu. Balíček nemá licenci, je proprietární. Text proto nekopírovat, převzít jen principy.

- `skills/framer/SKILL.md` (206 řádků): tenký statický skill. Obsahuje workflow, pravidla volby metod a bezpečnost.
- `skills/framer/projects/__template__/`: šablony, ze kterých CLI při `session new` vygeneruje kontext projektu.
- `skills/framer-code-components/SKILL.md` (2531 řádků): reference property controls a 4 vzorové komponenty.
- Hlavní know-how (core-principles, design-rules, guardrails, DSL grammar) v balíčku **není**. Server ho generuje za běhu do `projects/<id>/prompt/`. Vidíme tedy architekturu, ne obsah.

## Vzory, které stojí za převzetí

1. **Jeden příkaz `setup`.** Nainstaluje skills pro všechny agenty (Claude, Codex, Cursor) najednou.
2. **Tenký skill + vygenerovaný kontext projektu.** Při startu session vznikne:
   - `index.md` s **task mapou** (tabulka „Dělám… | Přečti nejdřív“): sekce Anything je povinná vždy, ostatní řádky jen podle úkolu.
   - `project-inventory.md`: snapshot stránek, komponent, CMS, stylů, fontů a ID.
   - `recipes.md`: hotové postupy, čte se jen na odkaz z mapy.
3. **Session se stavem.** Jedna session na konverzaci. Objekt `state` drží výsledky mezi voláními („API je pomalé, neopakuj volání“).
4. **Vysokoúrovňový DSL místo nízkých API.** Jasné pravidlo, kterou metodu kdy použít (`applyChanges` místo `createNode`/`setAttributes`).
5. **Dokumentace na vyžádání.** `docs Collection.getItems` místo celé reference v promptu.
6. **Bezpečnost.** Automatická větev při úpravě. Agent přejmenuje větev podle úkolu a pošle URL. Před nevyžádanou nebo destruktivní změnou se zeptá. Před hlášením „hotovo“ změnu zpětně přečte.
7. **Pravidlo pro kompakci.** Po kompakci znovu načíst skill, index a sekce z mapy.
8. **Uživatelské project skills.** Název = slash příkaz, popis = kdy použít, instrukce = pravidla. `@mention` stránky jako zdroje pravdy. Slova „must / prefer / can“. Vždy napsat, co se nesmí změnit a kdy je hotovo. Pět typů: effects, design system, brand voice, writing standards, launch review.

## Srovnání s tím, co už máme (SolidPixels)

Už máme: MCP `solidpixels 3.0` (canvas API), skills `solidpixels-site-builder`, `solidpixels-cms-first`, `solidpixels-feedback-batch`, `solidpixels-lb-cdp-editing`.

Chybí nám:

- vygenerovaný **inventář webu** (stránky, sekce, knihovna, třídy, barvy, fonty) při startu práce na webu;
- **task mapa** místo dlouhých skills, které se čtou celé;
- **skills pro konkrétní web** (design system, tón, launch review) s must/prefer/can;
- jeden **setup** příkaz pro Claude i Codex (Sol).

Zdroje: https://www.framer.com/agents/external/ · https://www.framer.com/developers/ · https://www.framer.com/academy/lessons/framer-project-skills · https://frameplate.co/blog/framer-skills · https://www.skills.sh/framer · https://www.npmjs.com/package/@framer/agent
