# Portfolio 2026 Source Truth

**Authority:** Hermes ticket `t_67a031b8` is the sole factual source for this document. Anything not supplied there is marked **TBD** and must not be inferred.

## Product contract

**The Vitek Machine** is a replayable kinetic arcade/workshop portfolio. Projects are physical cartridges. Scroll drives the mechanism forward and reverses it when direction reverses; drag moves modules; click or press seats and ejects parts with a crisp mechanical payoff.

**Purpose:** present four projects through an understandable, memorable interactive portfolio while keeping their content public-safe.

**Audience:** **TBD — requires sourced audience definition.**

## Cartridge register

There are exactly four cartridges; no additional or substitute projects belong in this direction.

| Cartridge | Public-safe preview | Sourced description | Evidence/provenance | Live URL |
| --- | --- | --- | --- | --- |
| GameOnVB | **TBD** | **TBD** | **TBD — source and usage rights required** | Omit until independently verified public and current |
| Suburbs | **TBD** | **TBD** | **TBD — source and usage rights required** | Omit until independently verified public and current |
| Screen Switch | **TBD** | **TBD** | **TBD — source and usage rights required** | Omit until independently verified public and current |
| VoleyEvents | **TBD** | **TBD** | **TBD — source and usage rights required** | Omit until independently verified public and current |

Only a public-safe preview and sourced description may be published for each cartridge. Do not show source code, repository views, code snippets, fake terminals, invented metrics, claims of repository access, or unverified live URLs. Descriptions, imagery, attribution, rights, client claims, metrics, dates, roles, and links remain **TBD** until supported by evidence.

## Visual and interaction language

- **Palette:** obsidian `#0A0B0F`; warm aluminium `#D8D1C4`; signal orange `#FF5A1F`; electric cyan `#42E8FF`. Acid yellow `#D7FF3F` is reserved for secrets and rewards.
- **Material:** physical cartridge and workshop-machine cues using the named obsidian and warm aluminium. Surface finish, wear, lighting, and fabrication details are **TBD**.
- **Type:** typography family, scale, weights, and licensing are **TBD**. Type must support immediate comprehension and controls; no typeface is implied.
- **Motion:** kinetic, mechanical, reversible, and input-coupled. Seating and ejection end in a crisp payoff; motion must preserve causality between user action and machine response.

## Candidate technical stack

Locked candidate stack for prototype evaluation:

- Vite + React + TypeScript
- React Three Fiber / Three.js
- GSAP + ScrollTrigger
- CSS for layout and simple states
- local typed content
- static hosting

React Three Fiber is conditional, not mandatory: if the winning prototype is credibly DOM/SVG + GSAP, do not force R3F. Physics is excluded unless the next prototype ticket proves it materially necessary. A static/no-WebGL path is a content-access fallback, not a decision that the primary renderer must be optional.

## Explicit non-goals

- No portfolio implementation, framework scaffold, assets, generated imagery, package setup, or deployment configuration in this gate.
- No project facts or evidence beyond sourced, public-safe material.
- No source code or repository-oriented presentation.
- No physics without material prototype evidence; no renderer chosen for novelty rather than the winning interaction evidence.
- No revival of prior theme, pale-paper palette, reflective-fluid visual, framework, project-set, renderer-policy, or old-repository-search directions. Next.js is not the candidate framework.

## Exit gate for `t_86ba9207`

Prototype work may use only the contracts above and the companion storyboards. Before publishing project content, resolve each **TBD** with a named source and rights/public-safety check; otherwise omit it.