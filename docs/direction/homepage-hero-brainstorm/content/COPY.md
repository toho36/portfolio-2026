# Homepage landing — schválené texty (T0, 2026-10-10)

Stav: headline a hero line schválil majitel 2026-10-10 („proceed s doporučením“). Ostatní věty jsou převzaté z existujícího obsahu (zdroj u každé). Nová tvrzení nejsou.

## 1. Hero

- Name: **Hoang Viet To**
- Role: **Software Developer** (`HOME_COPY.role`, `src/content/homePosters.ts`)
- Headline: **I build web platforms and the systems behind them.** (schváleno)
- Line: **At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product.** (schváleno)
- Links: `Work` → `#work`, `Contact` → `#contact`
- Proof panel label: `GameOnVB — from event to attendance` + štítek `Reconstruction with demo data` (texty kroků v `P1-SCRIPT.md`, T0a)

## 2. Selected work (Rejstřík)

| Pořadí | Název | Role | Solo / team | Věta příspěvku | Zdroj |
|---|---|---|---|---|---|
| 1 | SolidPixels | CMS, frontend, backend, integrations | Team | I work with other developers on a CMS platform and client sites: frontend, backend and third-party integrations. | `homePosters.ts` solidpixels.body, memory `portfolio-copy-facts` |
| 2 | GameOnVB | Full-stack developer | Solo | A registration and operations system for recurring recreational volleyball events. | `projects.ts` voleyevents.preview / role |
| 3 | Screen Switch | Independent macOS developer | Solo | A native menu-bar macOS utility that exchanges eligible windows between displays. | `projects.ts` screen-switch |
| 4 | Goal Loop | — (vlastní nástroj) | Solo | Several models build, critique and review. Every result passes explicit verification gates or is blocked. | `homePosters.ts` goal-loop.body |
| odkaz | Playground | — | Solo | A real-time 3D skill game. | `homePosters.ts` playground.body |

GameOnVB detail (z `projects.ts`):
- Constraint: Bring registration, payment matching, cancellation credit and organizer administration into one coherent flow.
- Decision: Model money, capacity and audit as part of the registration lifecycle rather than bolted-on admin tasks.
- Link: `View project` → `/gameonvb`, živý web `https://gameonvb.cz/`.

Screen Switch detail (z `projects.ts`):
- Constraint: Preserve useful window geometry and fail visibly when Accessibility permission or destination displays are unavailable.
- Decision: Keep the utility menu-bar-only; preserve normalized position and size where possible, then clamp to the destination's visible area.

Goal Loop: `View project` → `/goal-loop`.

## 3. SolidPixels detail (jen text, žádné UI)

- Context: Team work on a CMS platform and client sites.
- My part: frontend, backend and third-party integrations.
- Team result vs. my part: the platform and the client sites are team work; my contribution is the frontend, backend and integration work within them.
- Example (problém → změna → ověření): **CHYBÍ — majitel dodá jeden zveřejnitelný příklad.** Do té doby se příklad nezobrazuje (sekce funguje bez něj).

## 4. How I work (max. 60 slov)

> I work alone on my own products and with other developers at SolidPixels. I adopt new tools early and hold their output to the same standard as my own: every change is checked before it ships. Goal Loop is how I run that process.

Zdroj: `HOME_COPY.positioning` (`homePosters.ts`), Goal Loop body. 54 slov.

## 5. Contact

Beze změny: existující `ContactPoster` (`src/pages/Home.tsx`), `HOME_COPY.contactCta`, odkazy z `CONTACT` (`src/content/systems.ts`).
- Section heading: „Let's talk about your project.“ (`homePosters.ts` contact.heading)
- Body: „Roles, collaborations or a difficult software problem. I usually reply within a few days.“

## Vyřazeno

„New tools. Old standards.“ jako headline (lze číst jako „staré postupy“).
