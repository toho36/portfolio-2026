# `/playground` design contract

Status: **APPROVED — independent Opus design review, 2026-08-11**  
Kanban authority: `t_3c891ac4`  
Outcome: one isolated technical/UX experiment; not a case study and not a redesign of `/`, `/voleyevents`, or `/goal-loop`.

Approval authorizes child-ticket capture only. It does not authorize implementation, dependency installation, tests, commit, push, or deploy.

## Decision

Build **Signal Relay**: one luminous signal travels through a spatial feedback loop as the visitor scrolls. Forward scroll advances the signal; reverse scroll reconstructs the same states backward. The scene ends by routing the signal back to its origin.

The first viewport says, in real HTML:

- `SIGNAL RELAY`
- `Scroll to route the signal. Reverse to rewind.`

The shared HTML header is already visible and supplies the ordinary Homepage link. The signal is already visible entering the first gate. No duplicate back link, loader, or tutorial appears.

This is one mechanic, not an effects gallery. The input is native document scroll; the immediate acknowledgement is signal movement; the physical response is passage through nested gates; the payoff is a visibly closed loop. Expected comprehension: “scroll routes the signal through the loop” within three seconds.

Rejected:

- drag/physics desk — harder to explain and weaker on mobile/keyboard;
- another Vitek Machine — retired metaphor, wrong outcome;
- passive cinematic/video scrub — technically reversible but not meaningfully spatial;
- project or work content inside the scene — would turn the experiment into a fake case study.

## Experience structure

The route uses a normal document with one tall choreography section and a sticky visual stage. GSAP observes native scroll progress; it does not replace wheel, touch, keyboard, scrollbar, history, or browser scrolling. The scene is not pinned by ScrollTrigger; CSS `position: sticky` supplies the visual stage while semantic HTML remains in document flow.

Four deterministic beats:

1. **INPUT** — signal enters a straight warm-metal rail.
2. **FOLD** — the rail turns through nested rings; foreground/background occlusion establishes depth.
3. **FEEDBACK** — a branch returns behind the camera-facing assembly and reconnects with the input path.
4. **CLOSED** — the loop aligns, the signal completes one circuit, and HTML exposes `Replay relay`; shared Homepage navigation remains visible.

Beat labels, instructions, status, controls, navigation, and fallback stay in HTML/SVG. Canvas is `aria-hidden` and never owns focus, text, links, or meaning.

## GSAP motion contract

- One scoped GSAP timeline maps progress `0..1` to all scene transforms and HTML stage-state changes.
- ScrollTrigger uses native scroll with `scrub: true`; no smoothing lag. Reverse scroll sets the exact reverse timeline state rather than launching a forward replay.
- No ScrollSmoother, body transform, wheel interception, mandatory pinning, or custom scrollbar.
- Route entry temporarily puts the root scroller in `scroll-behavior: auto` through a route-scoped document class and restores the previous class/state on exit. The current global `html { scroll-behavior: smooth }` must not add a second lagging scroll owner.
- `Replay relay`, `Previous beat`, and `Next beat` are explicit user actions. Each moves native document scroll to the relevant choreography position; the timeline is always derived from scroll and is never sought independently.
- A programmatic seek may tween a numeric scroll proxy and call native `window.scrollTo` on update. Every scroll delta not authored by that tween kills it immediately, covering wheel/touch/keyboard, scrollbar dragging, focus scrolling, find-in-page, and extension/OS scrolling without enumerating input devices.
- Programmatic seek and live scroll have one owner at a time. After interruption, current native scroll position becomes authoritative.
- Route unmount runs one scoped `gsap.context().revert()` cleanup, kills the replay tween, and removes all input listeners and ScrollTriggers created by this route.
- Layout changes trigger one bounded refresh after stable sizing, not repeated refreshes during scrub.

The existing VoleyEvents `--lifecycle-progress` and Goal Loop `--run-progress` CSS view timelines remain the correct cheap solution for one SVG marker each. They do not coordinate a JavaScript/WebGL camera, rail, signal, HTML beat state, and interruptible exact beat seeks through one reversible playhead. GSAP is therefore accepted only for `/playground`; `scrub: true` removes the catch-up lag reported for the retired Conveyor and Machine Timeline prototypes. The comprehension/perceived-speed playtest below must prove this rather than assuming it. GSAP and Three.js are dynamically imported only after the static Playground component mounts; existing routes must not import either runtime.

## Why Three.js earns its place

Three.js owns only the spatial relay assembly and signal. It adds a property the SVG fallback cannot fully reproduce: the path crosses behind and in front of nested gates, with perspective, occlusion, lighting, and camera-relative alignment making the final reconnection legible as one closed object in space.

Renderer gate before full scene work:

- Build the cheapest representative scene: three nested gates, one returning rail, one moving signal, one light rig.
- Compare it with the SVG fallback at desktop and mobile sizes.
- Reuse the prior playtest format with **five unprimed participants** and randomize SVG/Three order. First show the untouched initial state for three seconds and ask only what input they would use and where they would exit. Then have them complete one scripted forward traverse and one reverse traverse in each version before asking where the return path travels, what completes the loop, and whether response felt `immediate`, `slightly delayed`, or `too slow`. Record exact per-version answers in `docs/evidence/playground/spatial-playtest.md`; do not invent aggregate ratings.
- The central GSAP/native-scroll mechanic is scored **only on the SVG version**, which isolates the scroll playhead from renderer cost. It passes only when at least **4/5** participants identify native scroll within three seconds, at least **4/5** call SVG forward/reverse response `immediate`, and **0/5** call it `too slow`. Failure stops the roadmap and returns the mechanic to this design ticket; no renderer child or later implementation child proceeds.
- Three.js additionally passes only when at least **4/5** participants identify both the behind/in-front return path and closed loop after traversal, and Three beats SVG by at least **2 participants** on that spatial question. Any participant missing the shared Homepage exit is a design blocker to fix and retest.
- If the central SVG mechanic passes but Three misses the spatial threshold **or any participant calls only the Three version `too slow`**, remove Three.js from `package.json` and `package-lock.json`, move the single `three` constant back to the globally retired dependency set in `src/sourceClosure.test.ts`, retain route-scoped GSAP permission, and ship the SVG experience. “Three.js was requested” is not evidence.

No React Three Fiber is proposed. This scene has one renderer, one camera, one timeline, and no React-owned 3D interaction state. Direct Three.js is the smaller runtime and lifecycle surface. No physics, Drei, post-processing framework, second renderer, or second motion engine.

This deliberately reverses part of the retirement guard in `src/sourceClosure.test.ts`, which currently bans GSAP and Three.js everywhere. The implementation must **re-scope, not delete**, that guard:

- `@react-three/fiber` and `@types/three` remain forbidden in package and source closure;
- `gsap` and `three` become permitted dependencies;
- imports of `gsap`, `gsap/*`, `three`, or `three/*` are permitted only below `src/playground/`;
- `App.tsx`, existing pages, shared content, and existing route modules may reference only the local static Playground page/runtime boundary, never those packages directly;
- package-script closure remains exact; the budget checker runs directly with Node and adds no package script.

The old Vitek Machine documents under `docs/direction/`, `docs/art-direction/`, and `docs/prototypes/` are historical evidence, not current implementation authority. Their “locked” R3F/GSAP stack applies only to the retired machine direction. This contract supersedes them for `/playground`; current source, README, and this approved route-specific contract govern.

## Visual direction

Name: **Instrument Black / Closed Signal**.

Reuse the shipped shell’s Arial/Helvetica stack and semantic colors instead of adding a font or design system:

- field: existing `--ink` / `#090909`;
- readable text and warm metal: existing `--paper` / `#f2efe6`;
- signal and completion state: existing `--signal` / `#d9ff43`;
- focus and secondary energy: existing `--focus` / `#63e6ff`;
- structure: existing `--line` / `#42413d`.

Composition is sparse: one large object, one signal, at most three depth layers, no HUD, card grid, gauges, particles, bloom stack, cyberpunk city, glass panels, marquee, generated labels, or decorative telemetry. Acid signal color communicates progress, not a fake metric.

Visual priorities:

1. moving signal and readable path;
2. HTML instruction/current beat;
3. persistent escape and replay controls.

## Asset pipeline

Decision: **manual procedural 3D + hand-authored SVG; no Gen2 assets in v1**.

- Geometry: Three.js primitives and authored curves; no downloaded GLB and no fake generated geometry.
- Materials: flat/physical colors, one restrained procedural surface treatment, no required bitmap texture.
- Fallback: hand-authored SVG using the same path topology and HTML beat labels.
- Icons/marks: simple SVG geometry only. No generated text, logo, brand mark, or interface copy.
- Provenance: all v1 visual assets are repository-authored; no external rights ledger is needed beyond source authorship.

Reason: the hypothesis is spatial legibility and reversible interaction. Gen2 moodframes would test taste, not the mechanic, and generated textures would add transfer, memory, and provenance cost before they earn anything. Reconsider one Gen2 moodframe/texture study only after the manual renderer passes comprehension and performance gates but lacks a specific, named material quality. Generated text and logos remain forbidden.

## Input and fallback matrix

| Mode | Operate | Feedback and outcome | Exit |
| --- | --- | --- | --- |
| Desktop pointer/trackpad | Native vertical scroll; click `Replay relay` only when requested | Continuous reversible signal and camera choreography | Shared HTML Homepage navigation; normal browser Back |
| Mobile touch | Native one-finger vertical page scroll; canvas does not capture gestures | Same four beats, lower quality tier, no precision gesture | Same 44×44 px shared Homepage link; browser Back |
| Keyboard | Native Space/Page/Arrow/Home/End scrolling plus explicit `Previous beat`, `Next beat`, and `Replay relay` buttons | Buttons move native scroll to exact beat boundaries; focus stays on the activated control; timeline remains scroll-derived; no canvas focus | Skip link, shared Homepage navigation, browser Back |
| Reduced motion | Normal document reading; Previous/Next/Replay are ordinary anchor links to the four beat sections | Four immediate SVG/HTML states; GSAP/Three do not load; no camera travel, parallax, continuous scrub, overshoot, or programmatic replay animation | Same links and focus order |
| No WebGL/context failure | SVG relay is visible from first paint; same normal scroll and beat buttons | Four SVG states communicate input → fold → feedback → closed | Same links; no reload prompt |

JavaScript-disabled rendering remains the current site-wide limitation: `index.html` has an empty React root, so every route is blank without JavaScript. Adding prerender/SSR or a second route-specific HTML entry would widen this isolated experiment and is explicitly out of scope. This does not weaken the required no-WebGL/context-failure fallback, which runs inside the existing React application.

The canvas is decorative enhancement. Continuous-scroll status is visible text but is not an ARIA live region. A dedicated `aria-live="polite"` node updates once only after discrete Previous/Next/Replay actions; scrub never writes announcements.

## Route, shell, focus, and navigation contract

- Add `/playground` as the fourth ordinary typed route with metadata: label `Playground`, title `Signal Relay Playground — Hoang Viet To`, description `An experimental reversible spatial signal relay built with native scroll, GSAP and progressive WebGL.`
- Preserve the shared skip link, header, main container, footer, contact links, and ordinary Homepage/VoleyEvents/Goal Loop navigation. The scene stays inside the existing maximum-width main column; full-bleed `100vw` breakout is rejected.
- The mobile primary navigation deliberately becomes a 2×2 grid with the same 44 px targets rather than squeezing four items into the current tested three-column row.
- Replace the catch-all App render ternary with an explicit exhaustive route render seam. `/goal-loop` must be explicit; `/playground` must never fall through to `GoalLoopPage`; unknown paths still resolve to Home through `resolveRoute`.
- Direct load, refresh, trailing slash, browser Back/Forward, modified-click/new tab, and query strings work through the existing route seam.
- Vercel gets only `/playground` and `/playground/` rewrites to `/index.html`; no wildcard rewrite.
- The public sitemap includes `/playground`; README route/stack/deployment copy becomes explicit about the route-local lazy runtimes. The branded 404 remains unchanged.
- Extend the existing route-title effect to apply each route’s `title`, `description`, canonical URL, and `og:url` after React loads. Direct static HTML still initially contains homepage metadata; this is the same SPA/no-prerender limitation explicitly accepted above, not a claim of route-specific server rendering.
- Mandatory replacement assertions: rename the stale `routes.test.ts` case to “admits only the four ordinary routes”, expect exactly the four records, and preserve navigation eligibility; `App.test.ts` proves all four route components render distinctly, all rendered links retain `target-link`, and Playground never falls through to Goal Loop; `deployment.test.ts` expects exactly six narrow rewrites and four sitemap URLs; `styles.test.ts` proves the 2×2 mobile nav; `sourceClosure.test.ts` enforces the current scoped dependency policy while keeping `three` restoration a one-constant move if the renderer gate fails. These are required acceptance evidence, never optional ticket decoration.
- Route entry focuses `#main-content` through the existing navigation behavior. Scene progress never moves focus.
- The existing header brand and Homepage link remain real `<a href="/">` exits, visible without hover, outside canvas, minimum 44×44 px. No duplicate back control is added inside the scene.
- Leaving `/playground` destroys the renderer and motion runtime; returning creates a fresh instance from route/scroll state. No hidden persistent canvas.
- Reduced motion prevents renderer creation in JavaScript and leaves the SVG baseline in place; it does not hide the canvas through `display:none`, `visibility:hidden`, or zero height inside the tested CSS reduce block.
- The static Playground component and hand-authored SVG baseline are part of the shared initial application bundle so they can render before runtime imports. They must fit the shared ≤12 KiB gzip regression budget; GSAP, ScrollTrigger, and Three.js stay in route-only lazy chunks.

## Performance budget

Budgets are acceptance limits, not targets to consume.

### Delivery and loading

- Existing `/`, `/voleyevents`, and `/goal-loop`: no eager GSAP/Three import and no new scene asset request.
- Shared initial JS regression caused by route registration, static component, and SVG baseline: **≤ 12 KiB gzip** against the pre-change production build.
- Lazy `/playground` JS, including GSAP, ScrollTrigger, Three.js, and route runtime: **≤ 250 KiB gzip**. This is intentionally much larger than the current site and is acceptable only because it is route-local and requested on demand.
- Route-specific visual assets: **≤ 300 KiB transferred** on first visit; manual v1 should be well below this.
- HTML/SVG fallback and instruction render before the lazy runtime; no loader and no blank canvas wait state.
- Lab mobile targets: LCP **≤ 2.5 s** and CLS **≤ 0.05** under Lighthouse mobile defaults in the installed stable Chrome; scripted discrete controls have p98 Event Timing interaction latency **≤ 200 ms**. Exact Chrome/Lighthouse versions and throttling settings are recorded. This does not pretend a lab run is field INP.

### Renderer

| Tier | Trigger | DPR cap | Triangles | Draw calls | Bitmap textures |
| --- | --- | ---: | ---: | ---: | ---: |
| High | stable desktop GPU and frame time | 1.5 | 20k | 15 | 0 |
| Medium | default desktop / strong mobile | 1.25 | 12k | 10 | 0 |
| Low | constrained mobile or regression | 1.0 | 6k | 6 | 0 |

- Desktop target: p95 frame time **≤ 18 ms** during scrub.
- Mobile target: p95 frame time **≤ 25 ms** during scrub.
- Runtime-ready is the first stable frame after scene compilation, sizing, and the single bounded ScrollTrigger refresh. From that marker through steady interaction and tier swaps: **0 long tasks > 50 ms**.
- Quality degrades before input coupling: signal position and HTML status remain exact at every tier.

### Adaptive quality

- Pre-build the tiny High/Medium/Low geometry/material variants during initialization. Tier changes swap existing references and DPR only; they never rebuild geometry or compile a new material during scrub.
- Start at Medium; capability hints may lower the initial tier but never raise it above High.
- Measure p95 frame time during real scrub in non-overlapping 2-second windows.
- Choose one platform target before measurement: desktop `T=18 ms`, recovery `R=14 ms`; mobile/coarse-pointer `T=25 ms`, recovery `R=19 ms`.
- High drops to Medium after two consecutive windows above `T`; it has no upward transition.
- Medium drops to Low after two consecutive windows above `T` and may recover to High only after 5 continuous seconds below `R`.
- Low remains a measuring renderer state: it may recover to Medium after 5 continuous seconds below `R`, but two consecutive windows above `T` surrender to SVG.
- SVG surrender is terminal for the visit. No renderer is recreated until a deliberate route revisit/reload, which starts again no higher than Medium.
- After any transition, wait 5 seconds before another upgrade; a downgrade remains immediate after its two-window proof. This hysteresis prevents tier flapping.
- A tier change may alter DPR, radial/curve segments, shadow use, and material complexity. It may not alter route state, signal progress, beat timing, controls, text, or fallback.
- `prefers-reduced-motion`, failed context creation, context loss, or repeated Low-tier misses switch to SVG/static mode rather than fighting the device.

## Lifecycle and cleanup contract

On route exit or fallback switch:

1. stop animation loop and cancel every `requestAnimationFrame`;
2. revert the scoped GSAP context and kill route-owned ScrollTriggers/replay tween;
3. remove resize, visibility, context, input, and media-query listeners; disconnect observers;
4. traverse the scene and dispose geometries, materials, textures, and render targets;
5. call `renderer.dispose()`; because the renderer is route-local and never reused, release its WebGL context after disposal;
6. remove canvas references and return the route to its static HTML/SVG baseline.

Acceptance probe: enter and leave `/playground` ten times. After each exit, there is no canvas, route-owned ScrollTrigger, animation frame, listener-driven update, or live WebGL context from the prior visit. Heap/GPU measurements may fluctuate, but retained route-owned resources must not grow monotonically.

## Measurement and durable evidence

Every accepted number maps to a named instrument and persisted artifact:

- **Bundle gzip:** a repository script using Node `zlib.gzipSync` reads Vite’s production manifest/chunks, compares the pre-change baseline with shared and Playground chunks, exits non-zero above 12/250 KiB, and writes `docs/evidence/playground/bundle-budget.json` with byte counts, chunk names, build commit, and tool versions.
- **Assets:** the same script totals route-specific emitted assets and fails above 300 KiB transferred.
- **Triangles/draw calls:** an evidence-only diagnostics flag samples `renderer.info.render.triangles` and `renderer.info.render.calls` for each tier; sanitized results go to `docs/evidence/playground/renderer-budget.json`. Diagnostics render no public metric or HUD.
- **Frame time/long tasks/adaptive transitions:** a bounded browser probe records rAF samples plus `PerformanceObserver('longtask')` entries while executing one forward/reverse trace. Desktop evidence uses 1440×900 on the development Mac. Mobile evidence requires a **real physical 2021-class-or-newer phone** (minimum iPhone 13/A15 Safari or Pixel 6/Tensor Chrome); desktop device emulation is not mobile performance proof. The exact model, SoC, OS, browser, viewport, and DPR go into `docs/evidence/playground/runtime-budget.json` with raw samples, p95 calculations, tier transitions, and run date.
- **Forced adaptive paths:** pure controller tests feed frame windows across desktop and mobile `T/R` boundaries. A localhost-only evidence seam, unavailable on non-loopback hosts and rendering no UI/HUD, lets the production-preview CDP probe feed the same bounded windows and verify High→Medium, Medium→Low, Low→SVG, and recovery transitions with real renderer swaps. The artifact records both real unforced traces and forced transition traces; neither may substitute for the other.
- **Loading/layout:** Chrome Lighthouse mobile JSON is stored at `docs/evidence/playground/lighthouse-mobile.json`; LCP and CLS are read from that artifact. The browser runtime artifact stores `PerformanceEventTiming` samples for discrete controls and checks p98 ≤200 ms separately.
- **Lifecycle:** a CDP script performs ten `/playground` ↔ `/` cycles and records canvas count, route-owned `ScrollTrigger.getAll()` count, active route diagnostics, and renderer/context create/dispose counters after each exit in `docs/evidence/playground/lifecycle.json`. A DevTools heap snapshot before/after is operator evidence when retained resources look suspicious, not the sole pass oracle.
- **Visual/input matrix:** screenshots and a concise operator log cover 1440×900, 390×844, keyboard, reduced motion, forced WebGL creation failure, context loss, direct load, refresh, Back/Forward, and replay interruption. Save under `docs/evidence/playground/` with no secrets or machine-specific absolute paths.

No metric is accepted from prose alone. The implementation tickets must include the exact script paths and commands that produce these artifacts; existing `npm run test`, `npm run check`, `npm run build`, and `git diff --check` remain necessary but do not prove browser/runtime criteria.

## Evidence required before child tickets

The explicit design review must return `APPROVED` on all of these:

- one-mechanic comprehension and rejected alternatives;
- GSAP/native-scroll ownership, reverse behavior, replay interruption, and cleanup;
- testable Three.js spatial-advantage protocol and delete-on-fail gate;
- desktop/mobile/keyboard/reduced-motion/no-WebGL matrix plus the explicit site-wide JS-disabled limitation;
- manual asset pipeline and generated-text/logo prohibition;
- numeric delivery, renderer, adaptive-quality, and lifecycle budgets;
- isolated typed route and narrow Vercel deep-link seam;
- preserved `/`, `/voleyevents`, and `/goal-loop` behavior.

Only after approval may Kanban capture create narrow serial implementation tickets. Proposed seams, not yet tickets:

1. semantic `/playground` route + SVG/no-WebGL baseline + narrow static rewrites;
2. scoped GSAP native-scroll playhead + explicit button seeks/replay interruption;
3. cheapest disposable Three.js spatial-proof scene + five-person keep/delete gate;
4. retained renderer only: adaptive tiers, lifecycle cleanup, and browser/performance matrix.

No implementation, dependency install, test change, commit, push, or deploy belongs to this design gate.

## Sources checked

- Current repository: `package.json`, `src/App.tsx`, `src/content/routes.ts`, `src/styles.css`, `vercel.json`, `public/404.html`, route/deployment tests, and existing direction/prototype documents.
- GSAP guidance: scoped `gsap.context()` cleanup, ScrollTrigger inclusion in context reversion, and direct `scrub: true` progress mapping.
- Three.js guidance: explicit disposal of geometry/material/texture resources plus renderer disposal and route-local context release.
- UI/UX advisory search was rejected where it conflicted with the contract: no portfolio grid, marquee, hover-only mechanic, haptics, generic blue palette, or Kinetic Brutalism package.
