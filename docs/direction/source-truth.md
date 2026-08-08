# Portfolio 2026 Source Truth

**Authority:** Hermes ticket `t_67a031b8` is the factual source for this document, with the cartridge register narrowly superseded by the source-admitted facts in `t_9928e4ba`. Anything not supplied by those scoped authorities is marked **TBD** and must not be inferred.

## Product contract

**The Vitek Machine** is a replayable kinetic arcade/workshop portfolio. Projects are physical cartridges. Scroll drives the mechanism forward and reverses it when direction reverses; drag moves modules; click or press seats and ejects parts with a crisp mechanical payoff.

**Purpose:** present four projects through an understandable, memorable interactive portfolio while keeping their content public-safe.

**Audience:** **TBD — requires sourced audience definition.**

## Cartridge register

There are exactly four cartridges; no additional or substitute projects belong in this direction.

| Cartridge | Preview | Role | Constraint | Decision | Evidence | Mechanical discovery | Verified URL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GameOnVB | A live event-registration front door for recurring recreational volleyball sessions. | Full-stack developer. | Keep registration and organizer workflows understandable around recurring events. | Put upcoming sessions and registration status first; administration supports the event instead of becoming the public narrative. | The current public site exposes upcoming events and community highlights. | `event dial` — reveals the registration route; reveals the sourced story. | https://gameonvb.cz/ |
| Suburbs | A motion-led skateboard storefront concept built around product drops and brand story. | Frontend developer. | Make the concept feel kinetic without hiding products or narrative behind motion. | Use scroll-led transitions and responsive layout to move from the latest drop into product story, reel, and team. | The current public demo exposes those sections and remains directly readable. | `deck flip` — turns the module surface; reveals the sourced story. | https://suburbs.vercel.app/ |
| Screen Switch | A native menu-bar macOS utility that exchanges eligible windows between displays. | Independent macOS developer. | Preserve useful window geometry and fail visibly when Accessibility permission or destination displays are unavailable. | Keep the utility menu-bar-only; preserve normalized position and size where possible, then clamp to the destination's visible area. | The owner-maintained screen-switch README documents permissions, display selection, geometry and partial-failure behavior. | `display swap` — exchanges two viewport plates; reveals the sourced story. | Omitted — no verified URL admitted. |
| VoleyEvents | A registration and operations system for recurring recreational volleyball events. | Full-stack developer. | Bring registration, payment matching, cancellation credit and organizer administration into one coherent flow. | Model money, capacity and audit as part of the registration lifecycle rather than bolted-on admin tasks. | The owner-maintained voleyevents README documents registration, QR-bank payment matching, cancellation credit and admin tooling. | `ledger gate` — clears a registration token through the mechanism; reveals the sourced story. | Omitted — no verified URL admitted. |

- Reviewed local sibling sources: `portfolio/lib/data.ts`, `screen-switch/README.md`, `voleyevents/README.md`.
- Independently fetched on `2026-08-08`: `https://gameonvb.cz/`, `https://suburbs.vercel.app/`.
- Correction: the stale old Suburbs `real estate development` claim is rejected; the current verified source is the skateboard concept.
- These facts and only these facts are admitted. No metrics, additional dates, clients, employers, stacks, images, screenshots, or inferred URLs.

Only the admitted public-safe preview and sourced story fields may be published for each cartridge. Do not show source code, repository views, code snippets, fake terminals, invented metrics, claims of repository access, or unverified live URLs. Imagery, attribution, and rights remain **TBD** until supported by evidence; anything else outside the admitted cartridge records must not be inferred.

## Visual and interaction language

- **Palette:** obsidian `#0A0B0F`; warm aluminium `#D8D1C4`; signal orange `#FF5A1F`; electric cyan `#42E8FF`. Acid yellow `#D7FF3F` is reserved for secrets and rewards.
- **Material:** physical cartridge and workshop-machine cues using the named obsidian and warm aluminium. Surface finish, wear, lighting, and fabrication details are **TBD**.
- **Type:** typography family, scale, weights, and licensing are **TBD**. Type must support immediate comprehension and controls; no typeface is implied.
- **Motion:** kinetic, mechanical, reversible, and input-coupled. Seating and ejection end in a crisp payoff; motion must preserve causality between user action and machine response.

## Locked technical stack

- Vite + React + TypeScript
- React Three Fiber / Three.js
- GSAP + ScrollTrigger
- CSS for layout and simple states
- local typed content
- static hosting

React Three Fiber / Three.js is the primary renderer for the real-time machine. GSAP + ScrollTrigger is the sole authored motion and scroll engine; CSS owns layout and simple DOM states. Physics remains excluded unless measured interaction evidence proves simple deterministic snap/collision logic insufficient. The static/no-WebGL path is a content-access fallback, not a second renderer.

## Explicit non-goals

- No portfolio implementation, framework scaffold, assets, generated imagery, package setup, or deployment configuration in this gate.
- No project facts or evidence beyond sourced, public-safe material.
- No source code or repository-oriented presentation.
- No physics without material prototype evidence; no renderer chosen for novelty rather than the winning interaction evidence.
- No revival of prior theme, pale-paper palette, reflective-fluid visual, framework, project-set, renderer-policy, or old-repository-search directions. Next.js is not the candidate framework.

## Exit gate for `t_86ba9207`

Prototype work may use only the contracts above and the companion storyboards. Before publishing project content, resolve each **TBD** with a named source and rights/public-safety check; otherwise omit it.
