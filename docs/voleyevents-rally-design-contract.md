# `/voleyevents` rally design contract

Status: **APPROVED — independent Opus round 3 and owner approval, 2026-08-13**
Kanban authority: `t_baefbb35`
Selected challenger: **B — Impossible Court Staircase**

This contract concerns only the portfolio route `/voleyevents` in this repository. It does not authorize or touch the VoleyEvents product repository. Approval permits serial child-ticket execution; it does not permit MiniMax rendering, push, or deploy.

## Reconciliation

Commit `09eb197` replaced the old hero image with a local SVG volleyball flight. It provides a useful first beat: separate translation/spin transforms, impact response, reduced-motion state, offscreen pause, teardown, semantic route content, and zero canvas. It does not satisfy this ticket because it loops independently inside the hero and does not connect the case-study sections through one native-scroll spatial rally.

Fresh baseline on `09eb197` HEAD:

- `npm run test`: 179/179 pass;
- `npm run check`: pass;
- `npm run build`: pass;
- `git diff --check`: pass;
- desktop runtime: localized hero SVG, zero canvas, four semantic lifecycle stages, zero horizontal overflow.

The current hero flight is not retained as a second autonomous animation. `VolleyballMotion.tsx`, `ballFlight.ts`, and `ballFlight.test.ts` are retired in child 1; the static fallback uses authored SVG/CSS with no sampled flight loop.

The existing `.lifecycle-court` lane and `.participant-token` view-timeline are also retired in child 1. Their four stops are subsumed by the one staircase fallback/runtime, so the page never has two scroll-driven decorative owners. `voleyEvents.test.ts` replaces all five retired sites: line 81 participant-token count, lines 99–100 lifecycle-court container/aspect ratio, line 102 volleyball-motion class, and the complete position/spin/impact test at lines 105–119. Their replacement proves exactly one static staircase container and four landing markers. `styles.test.ts` replaces the complete current `VoleyEvents lifecycle styles` block at lines 179–230 with static staircase containment, alternating desktop reading zones, one-column mobile reading, and reduced-motion visibility assertions.

## Challenger decision

Three art-direction moodframes were compared as stills, not runtime proof:

| Challenger | Strength | Decisive failure or win | Verdict |
| --- | --- | --- | --- |
| A — macro volleyball + impact-wave tunnel | Immediate object identity, dramatic close-camera material | High risk of becoming one sphere following a curve; weak coupling to semantic section structure | Reject |
| B — impossible court staircase folding in depth | Court planes create unmistakable depth and literal alternating landings for HTML sections | More authored geometry/camera work, but the cost directly buys the route's narrative structure | **Select** |
| C — instanced ball/node rally field | Efficient propagation and obvious instancing path | Visually and mechanically duplicates `/playground` System Field; risks wallpaper | Reject |

Moodframes are repository-persisted art direction only:

- A: `docs/art-direction/voleyevents-rally/a-macro-impact-tunnel.png`
- B: `docs/art-direction/voleyevents-rally/b-impossible-court-staircase.png`
- C: `docs/art-direction/voleyevents-rally/c-instanced-rally-field.png`
- provenance, prompts, dimensions, model, and SHA-256: `docs/art-direction/voleyevents-rally/generation.json`

They contain no approved copy, logo, final volleyball geometry, texture, or production asset. No generated image is required by the production runtime.

## Three-second mechanic

**Scroll serves one rally: the ball impacts an alternating court landing, the landing folds into depth, and the next semantic case-study block becomes the next reachable step; reverse scroll reconstructs every prior impact and fold exactly.**

Input → response → payoff:

1. Native scroll immediately advances or reverses ball spin, camera parallax, and the active landing.
2. At each of four deterministic impact stops, one bounded vermilion wave travels across the struck plane while the next court plane unfolds from depth.
3. The complete payoff is an impossible staircase made from the same four lifecycle states already present in semantic HTML, ending with the full connected operations lifecycle visible as one spatial ascent.

No tutorial, wheel/touch interception, smooth-scroll owner, custom cursor, autoplay sound, direct timeline seek, or independent looping hero. A route-scoped CSS `position: sticky` visual stage is allowed; ScrollTrigger `pin`/`pinSpacing` and any scroll-position rewriting are forbidden.

## Visual direction

Name: **Impossible Match / Operational Ascent**.

Reuse route colors: warm chalk `#f7f3e8`, court ink `#102044`, cobalt `#1557ff`, vermilion `#ff5a36`, acid ball `#c9ff36`. Three owns court planes, ball, light, shadow/occlusion, impact waves, and camera. HTML owns every word, heading, link, status, and control.

Scene grammar:

- one authored volleyball with renderer-native seams;
- five reusable court-plane meshes: hero serve plus four lifecycle landings;
- alternating left/right depth, not random positions;
- one restrained key light, one fill/hemisphere light, contact-shadow strategy only if it stays inside budget;
- no particles, node field, bloom stack, textures, GLB, physics, video, generic corridor kit, generated text/logo, HUD, or canvas copy.

The desktop reading zone alternates with the landing direction. A route-scoped gradient may protect only the active text zone. Mobile uses one DOM column; the sticky visual stage occupies a bounded upper 42svh zone behind no text, followed by each full-width semantic block in normal flow. Canvas and fallback never cross the text measure.

## Stage topology and DOM seam

Child 1 creates the complete stable markup consumed by later children:

- `<article className="voleyevents" data-rally-root="true">` remains the route root.
- One `<div className="rally-stage" data-rally-stage="true" aria-hidden="true">` is the first child after the hero section and before the problem section. It is route-level, CSS sticky, and visually spans hero serve through the four later lifecycle landings without reordering DOM content.
- The stage contains one repository-authored `<svg className="rally-fallback" data-rally-fallback="true">` with exactly five visual planes: hero serve plus four `data-rally-landing` markers.
- Child 3 appends exactly one `<canvas className="rally-canvas">` inside that same stage; no second mount point exists.
- `#lifecycle` keeps its heading and `<ol className="lifecycle-track">`, but its old `.lifecycle-layout`/`.lifecycle-court` wrapper is removed. Child 1 owns the alternating desktop `.lifecycle-stage:nth-child(odd/even)` reading-zone layout and the single-column mobile layout, including their `styles.test.ts` assertions.
- Child 2's page effect receives only refs to `[data-rally-root]` and `[data-rally-stage]`; runtime modules query neither document nor playground markup.

At mobile widths the stage is `position: sticky`, `top` below the shared header, `height: 42svh`, and appears as a separate visual band before the currently reached semantic block. The canvas uses `touch-action: pan-y`. No behind-text or side-by-side mobile variant exists.

## Semantic and interaction contract

The existing source order remains authoritative: hero → problem → constraints → decisions → lifecycle introduction → four ordered lifecycle stages → evidence → status → navigation. The visual staircase may align to these blocks but must not reorder, clone, hide, or move essential text into canvas.

- Canvas is `aria-hidden`, unfocusable, and decorative enhancement.
- Existing native links, direct fragments, modified clicks, browser Back/Forward, skip link, and route navigation remain ordinary HTML.
- Keyboard uses native scrolling; no `role=application` and no canvas focus.
- Pointer/touch may add bounded ball spin/parallax only while the scene is visible. It never captures vertical touch scrolling or changes route state.
- Any native scroll delta is truth. GSAP derives one playhead from measured document geometry.
- Forward, reverse, and rapid interruption set the same deterministic scene state for the same normalized progress. No catch-up lag or snap-back.
- Resize/orientation recomputes measured geometry once after stable layout and reapplies current native progress.

## Motion ownership and lifecycle

GSAP + ScrollTrigger are justified because one progress value must coordinate DOM landing states, camera, court geometry, ball transforms, impact uniforms, explicit interruption, and resize refresh. CSS timelines cannot own the Three scene. Three and GSAP remain separately loaded through route-local modules under `src/voleyevents/`; nothing imports implementation from `src/playground/`.

The route-level code boundary is mandatory: the static `VoleyEventsPage` effect dynamically imports exactly one `../voleyevents/loadRallyRuntime` orchestrator after reduced-motion eligibility. App and the page never statically import the orchestrator, adaptive controller, GSAP, or Three. This keeps those bytes out of the shared initial chunk despite the existing static page imports in `App.tsx`.

Three typing moves from `src/playground/three.d.ts` to shared declaration `src/three.d.ts`; neither runtime imports it. The source-closure assertion changes from `sourceModules['./playground/three.d.ts']` to `sourceModules['./three.d.ts']`. `/voleyevents` defines its own narrow structural `RallyThree` facade and injected `RallyWindow` shape at the runtime seam; no duplicate ambient declaration and no import from a playground module.

Child 2 must change all source-closure owners literally:

1. the scoped-prefix rule accepts only `./playground/` or `./voleyevents/` for GSAP/Three;
2. the exact GSAP importer list becomes `['./playground/loadRelayRuntime.ts', './voleyevents/loadRallyMotion.ts']`;
3. the exact Three importer list becomes `['./playground/loadSystemFieldRuntime.ts', './voleyevents/loadRallyThree.ts']`, with `.sort()` added before equality; each named loader contains exactly one literal `import('three')`, and the shared `src/three.d.ts` declaration remains asserted.

One route lifecycle owner:

1. checks reduced motion before requesting GSAP or Three;
2. creates route-local lazy imports with generation/cancel guards;
3. creates one renderer, one camera, one GSAP context, and route-owned ScrollTriggers;
4. renders on scroll, pointer/touch disturbance, resize, visibility return, or bounded settle only—no perpetual idle RAF;
5. pauses when the route/scene is offscreen or the document is hidden;
6. on exit kills scheduled frames/tweens/triggers, reverts context, removes listeners/observers, disposes geometry/material/render targets/renderer/context once, removes canvas, and restores only document state it owned.

The owner listens to `prefers-reduced-motion` changes after mount. Switching to reduce invalidates pending generations, destroys a live runtime, removes canvas, and restores the static fallback. Switching back may start one fresh eligible generation from current native scroll.

The source-closure guard changes narrowly: `gsap`, `gsap/*`, `three`, and `three/*` are allowed only below `src/playground/` or `src/voleyevents/`; each route has its own explicit dynamic loaders; shared pages/App/content remain forbidden import sites. Existing `/playground` loader and runtime modules are read-only and never imported by `/voleyevents`.

## Fallback matrix

| Mode | Result |
| --- | --- |
| Desktop WebGL | Full alternating court staircase, ball impacts, depth camera, exact reversible scrub |
| Mobile WebGL | Lower geometry/effect tier, shallower camera travel, one-column HTML, no text/canvas collision |
| Keyboard | Native page scrolling and existing anchors; same deterministic progress; visible focus |
| Reduced motion | Do not request GSAP or Three. Static authored SVG/poster plus complete semantic content and anchors |
| No WebGL/context failure/loss | Static SVG/poster remains; renderer is surrendered for the visit; HTML remains complete |
| Hidden/offscreen | No RAF or scene work; native content and navigation remain available |
| JavaScript disabled | Existing SPA limitation remains explicit: no SSR/prerender is added by this route-local work |

The fallback is repository-authored SVG/CSS derived from the selected composition. The generated moodframe is not shipped as the fallback.

## Adaptive quality and measurable budgets

Budgets are hard limits. Every number must be measured on the final candidate, not claimed from source prose.

### Delivery

- Existing `/`, `/goal-loop`, and `/playground`: zero eager VoleyEvents runtime imports or asset requests.
- Shared initial JS regression: ≤ 8 KiB gzip against `09eb197` build.
- Total lazy `/voleyevents` runtime including uncached GSAP, ScrollTrigger, Three, and route orchestrator: ≤ 245 KiB gzip attributable on a cold direct visit. The fresh `09eb197` build emits the existing playground vendor precedent at 229.64 kB gzip total (`three` 184.68 + `gsap` 27.42 + `ScrollTrigger` 17.54), leaving 15.36 kB gzip for the route orchestrator/controller.
- New route visual assets: ≤ 120 KiB transferred; target is zero bitmap assets.
- Fallback and HTML paint before runtime readiness; no decorative loader.

Instrument: child 4 enables Vite `build.manifest` and a directly invoked Node script uses `zlib.gzipSync` over manifest-owned chunks plus a CDP request log. It does not add an npm script, so the exact four-script assertion in `sourceClosure.test.ts` stays unchanged. Persist exact chunk/asset bytes, baseline SHA, Vite/Node versions, and cold-request attribution under `docs/evidence/voleyevents-rally/bundle-budget.json`.

### Renderer

| Tier | DPR cap | Court radial/segment equivalent | Draw calls | Triangles | Impact waves |
| --- | ---: | ---: | ---: | ---: | ---: |
| High | 1.5 | full | ≤ 18 | ≤ 30k | 2 |
| Medium (default) | 1.25 | medium | ≤ 14 | ≤ 20k | 1 |
| Low | 1.0 | low | ≤ 10 | ≤ 12k | 1 simplified |

Use `renderer.info` for draw calls/triangles and explicit renderer lifecycle counters. No bitmap textures, post-processing composer, real-time shadow map, or model decoder in v1.

### Frame and responsiveness

- Desktop 1440×1000: scrub p95 ≤ 18 ms.
- Mobile target device class: iPhone 13/A15 Safari or Pixel 6/Tensor Chrome, viewport near 390×844: scrub p95 ≤ 25 ms.
- Runtime-ready onward: zero long tasks > 50 ms during the scripted traversal.
- Scripted semantic link/keyboard interaction p98 Event Timing ≤ 200 ms.
- CLS ≤ 0.05; horizontal overflow exactly 0 at 320, 390, 768, 1024, and 1440 CSS px.

Instrument: rAF samples, `PerformanceObserver('longtask')`, Event Timing, layout rect probes, and console/request capture. Desktop emulation is layout proof, not mobile GPU proof.

### Adaptive controller

Initial capability is deterministic and UA-free. Rules are evaluated in this exact order; first match wins:

- no runtime: reduced motion, failed WebGL creation, or context loss;
- Low ceiling and Low start: coarse pointer, viewport width below 768 CSS px, known `navigator.deviceMemory <= 4`, or `navigator.hardwareConcurrency <= 4`;
- Medium ceiling and Medium start: any capability input unavailable, no WebGL2, viewport below 1280 CSS px, or known memory/concurrency below the High thresholds;
- High ceiling but Medium start: fine pointer, viewport at least 1280 CSS px, WebGL2 available, `deviceMemory >= 8`, and `hardwareConcurrency >= 8`.

The pure controller receives these values as injected inputs; tests cover every boundary and unknown value. In non-overlapping two-second windows use platform target `T` and recovery `R`:

- desktop `T=18 ms`, `R=14 ms`;
- mobile/coarse pointer `T=25 ms`, `R=19 ms`.

Two consecutive p95 windows above `T` downgrade one tier. Five continuous seconds below `R` may upgrade one tier, never above the initial capability ceiling. After a change, upgrades wait five seconds; downgrade evidence remains immediate. Two consecutive Low-tier windows above `T` surrender permanently to the static fallback for the visit; a passing/intermediate window resets that count. Tier changes swap prebuilt geometry/material settings and DPR; they never rebuild during scrub or alter progress/content.

## Browser/runtime acceptance

Required on the exact candidate SHA:

- desktop 1440×1000 and mobile 390×844 screenshots at hero plus every impact stop;
- direct load, trailing slash, fragments, Back/Forward, route isolation;
- keyboard tab/focus/native scrolling;
- reduced motion with zero GSAP/Three request and zero canvas;
- forced no-WebGL and context loss with usable static fallback;
- forward, reverse, and rapid alternating interruption with identical state at identical progress;
- pointer and touch disturbance without captured vertical scroll;
- resize/orientation and long-copy fit;
- 10× `/voleyevents` ↔ `/` route cycle: zero retained canvas, trigger, RAF, listener-owned update, or live context after each exit;
- overflow exactly zero, no console errors, failed requests, or hidden essential content;
- route request logs prove no VoleyEvents runtime on sibling routes.

## Serial implementation seams

Children must remain unassigned and dependency-ordered until this contract receives explicit owner approval. One writer only.

1. **Semantic staircase baseline and pure progress model** — preserve all current sourced-copy, reading-order, route-title, shell-navigation, claim-safety, direct/trailing-route, four-stage, and native-link assertions. Delete `VolleyballMotion.tsx`, `ballFlight.ts/test.ts`, the lifecycle lane/token SVG, and the five exact test sites listed in Reconciliation. Add the exact Stage topology markup, one static SVG staircase with four landing markers, alternating desktop lifecycle reading zones, single-column mobile layout, and focused progress/landing tests. `styles.test.ts` changes only the complete retired lifecycle block at lines 179–230 and old hero-graphic geometry block; focus, 44px, shared mobile header, Goal Loop, and System Field assertions stay byte-for-byte. No GSAP/Three import.
2. **Route-local lazy runtime boundary** — keep child 1 semantic assertions. Add the dynamic `loadRallyRuntime` page-effect boundary, independent `loadRallyMotion.ts` and `loadRallyThree.ts` cancellation guards, move the ambient declaration to `src/three.d.ts`, and apply the three literal source-closure changes above. `voleyEvents.test.ts` adds only static-markup/no-canvas/no-eager-runtime assertions; `styles.test.ts` is unchanged. No scene choreography.
3. **Impossible Court Staircase renderer and reversible playhead** — keep all child 1/2 semantic and closure assertions. Implement authored planes/ball/material/light/camera, native-scroll GSAP ownership, interruption, CSS-sticky stage, offscreen pause, and complete disposal. The runtime accepts injected `RallyThree`, `RallyWindow`, scheduler, observer, and motion facades; node-runnable RED tests prove disposal exactly once, authored-vs-human interruption/no snap-back, visibility/offscreen pause/resume, resize refresh, context loss, and canceled generation before browser proof. `styles.test.ts` adds only route-scoped sticky-stage, touch `pan-y`, text-zone, mobile, and reduced-motion rules. This is the only high-effort motion slice.
4. **Adaptive tiers and exact runtime evidence** — keep product/semantic assertions unchanged. Add the pure injected capability/window controller using the exact ceiling matrix above, localhost-only diagnostics/evidence seam, enable Vite manifest, add directly invoked measurement scripts without changing package scripts, and execute the full browser/device matrix. `styles.test.ts` changes only if a measured adaptive fallback class needs one route-scoped visibility assertion. No visual redesign.

Every child runs `npm run test`, `npm run check`, `npm run build`, and `git diff --check`; each defines narrower focused RED checks and literal writable paths. Local commit occurs only after full PASS and review. No push/deploy.

## Explicit gates

- Owner must explicitly approve this selected design before any child becomes runnable or any implementation begins.
- MiniMax remains excluded. A separate explicit approval immediately before queue/submission is mandatory; this contract neither needs nor recommends it for v1.
- Push and deploy remain separate explicit gates.

## Owner-approved corrective amendment — Obsidian Match / Warm Aluminium

Status: **APPROVED by owner `continue`, 2026-08-13**

Kanban authority: `t_6baa1cb4`

Material reference: `docs/art-direction/voleyevents-rally/d-obsidian-match-amendment.png`

Commit `643abad` satisfies the semantic, lifecycle, adaptive-quality, bundle, and runtime contracts, but its opaque pastel court slabs and acid sphere do not satisfy the intended authored showpiece. This amendment supersedes only the original material/lighting posture. Native scroll, one reversible ball, five court stops, semantic HTML authority, lazy loading, adaptive tiers, disposal, fallbacks, and every delivery/runtime budget remain unchanged.

### Corrected visual stance

- Court bodies use **smoked obsidian**: near-black mineral surfaces with controlled transparency. The page/background must remain visibly present through inactive planes; no plane may read as an opaque pastel card.
- Court perimeter and markings use **warm aluminium** through unlit `LineBasicMaterial` edge/marking geometry plus a low-metalness warm edge surface under the existing key/fill lights. No environment map or physically reflective metal is implied. The rendered edge/marking luminance must be at least `3:1` against the adjacent obsidian body. Cobalt remains a cool fill/accent and vermilion remains bounded impact energy.
- Use renderer-native material, geometry, opacity, light, and line work only. No bitmap texture, procedural texture dependency, environment map, GLB, model decoder, bloom, postprocessing, particles, rock supports, or repeated nets.
- The generated reference owns material, lighting, diagonal descent, and negative-space intent only. Its rocky vertical supports and repeated physical nets are explicitly rejected as image-generation slop. Production keeps five clean levitating court slabs.

### Volleyball identity and motion

- Keep exactly one ball. It must read as a volleyball within three seconds through contrasting curved panel seams, alternating warm-chalk/obsidian panels, a restrained acid-yellow accent, readable scale, and controlled key/rim light.
- Preserve the existing deterministic progress and impact ownership, but camera framing and ball/camera transforms may be retuned so descent is visible rather than cancelled by camera tracking. At the five exact progress stops (`0`, `.25`, `.5`, `.75`, `1`), the pure frame model must show a monotonic downward ball position relative to the camera target, with at least `0.8` world-unit separation between consecutive stops; forward and reverse still reconstruct identical frames. Do not add random balls, ball rain, physics, independent falling loops, or autoplay motion.
- Each impact receives one crisp bounded vermilion contact ring and a short local light/material response. No particle burst, bloom cloud, screen shake, or perpetual settle loop.

### Visibility and compositing contract

- Court material opacity stays in the closed range `0.32–0.68` at every pure-frame state; focused tests assert the minimum and maximum over the five exact stops. The renderer canvas remains transparent.
- Protect only the active HTML reading zone with the existing route-local gradient. Do not globally dim the scene or place an opaque page-sized wash behind the canvas.
- Every semantic reading state at hero plus the four lifecycle stops must measure at least WCAG `4.5:1` for body text and `3:1` for large headings against its actual rendered canvas/fallback composite. The route-local wash may cover the active reading column only; `problem`, `constraints`, `decisions`, `evidence`, and `status` must also be probed whenever geometry occupies their text rect. `styles.test.ts` may change only the VoleyEvents hero/rally/fallback/active-reading blocks needed to encode this isolation and contrast contract.
- Desktop geometry remains concentrated away from active copy. Mobile keeps the separate sticky `42svh` visual band; canvas never sits behind semantic text.
- Static SVG/CSS fallback must adopt obsidian bodies, warm-metal edges/lines, the single panelled volleyball, and one bounded impact accent. Delete every repeated `.rally-net`; neither runtime nor fallback renders a physical net. Court identity comes from boundary, center, and attack-line markings only. Reduced motion, no-WebGL, context loss, and permanent Low-tier surrender may not fall back to the retired pastel appearance.

### Corrective acceptance

1. Desktop hero and all four stops visibly preserve background depth through the court bodies and read as smoked obsidian with warm-metal structure.
2. One volleyball is identifiable within three seconds, and its descent/impact sequence remains identical for forward, reverse, and rapid interruption.
3. No opaque pastel slab, generic grey glass card, white marble, repeated net, rock support, random ball, texture, model, particle, or postprocessing effect ships.
4. Hero copy remains legible; mobile remains a separate visual band; overflow is zero at `320`, `390`, `768`, `1024`, and `1440` CSS px.
5. Reduced motion, no-WebGL, context loss, and adaptive static surrender show the amended fallback with visual parity.
6. Existing lazy-route, source-closure, quality-controller, renderer-cap, exact-disposal, bundle-budget, and physical-device gates remain mandatory on the amended candidate.

### Corrective child and evidence boundary

- Implementation ticket: `t_3130fd37`.
- Writable production files are exactly `src/voleyevents/rallyRuntime.ts`, `src/pages/VoleyEvents.tsx`, and the VoleyEvents rally/hero/fallback/active-reading blocks in `src/styles.css`.
- Writable oracle files are exactly `src/voleyevents/rallyRuntime.test.ts`, the fallback-only assertions in `src/pages/voleyEvents.test.ts`, and the existing VoleyEvents hero/rally/fallback/active-reading blocks in `src/styles.test.ts`. Adaptive quality, playhead ownership, loader boundaries, source closure, package metadata, and unrelated style tests are read-only.
- Deterministic proof covers opacity bounds, monotonic camera-relative descent, one ball/five courts/no nets, unchanged reversible frames, fallback parity, lifecycle/disposal, full tests/typecheck/build, exact bundle budget, and `git diff --check`.
- Controller-owned rendered proof is persisted under `docs/evidence/voleyevents-rally/obsidian-amendment/`: desktop and mobile hero plus four stops, sampled text contrast, reduced/no-WebGL/context-loss/static fallback, rapid reverse, overflow widths, and physical-device adaptive/performance evidence. This evidence-only directory is writable only during `t_dde4338d`, after the source candidate is frozen.

## Owner-approved topology amendment — Dedicated full-width rally band

Status: **APPROVED by owner, 2026-08-13**

Kanban authority: `t_f6cff70f`

This amendment supersedes only the behind-copy/right-reading-zone topology in **Visual direction**, **Stage topology and DOM seam**, the mobile sticky-top rule, and the active-reading wash clauses in **Visibility and compositing contract**. Renderer art, the five authored states, native-scroll ownership, route-local loading, adaptive quality, disposal, budgets, and fallback artwork remain unchanged.

### Corrected topology and dimensions

- The route source order is hero → rally band → problem. One non-semantic `<div className="rally-band">` immediately follows `.court-hero` and ends before `.case-problem`.
- The band contains the existing single `<div className="rally-stage" data-rally-stage="true" aria-hidden="true">`. That stage still contains the one repository-authored `data-rally-fallback` SVG, and the runtime still appends exactly one decorative `.rally-canvas` as a direct child. No second mount or copied semantic content is introduced.
- Desktop uses the full existing route column without viewport-width breakout or case-section inline margins. At `1440 × 1000` CSS px, the band must provide at least `1000` CSS px of usable width and the sticky visual stage must provide at least `560` CSS px of height.
- A tall `.rally-band` supplies reserved scroll runway for the five-state choreography while bounding the sticky stage's lifetime. The stage must leave sticky containment before `.case-problem`; hero copy and every semantic case-study block remain outside the stage rectangle at rest and during stickiness, never beside or behind the canvas.
- The existing read-only playhead still derives its impacts from lifecycle geometry below the band. Therefore the runway is reserved topology capacity; this amendment does not claim that all five runtime states currently play while the band is visible. Re-anchoring those states is a separate playhead concern outside this layout slice.
- At widths up to `760px`, `.rally-band` returns to automatic height and `.rally-stage` is a normal-flow, relatively positioned visual band with `top: auto` and height no greater than `42svh`. Semantic content follows below it in one column.

### Compositing and fallback

- The hero wash, route-content backfill, and active-reading lifecycle gradients existed only to protect copy behind the route-level stage and are retired. No global dim or replacement reading wash is allowed.
- Reduced motion, no WebGL, context loss, and permanent static surrender keep the same visible band and semantic order. The fallback remains fully visible until a ready runtime deliberately reduces its opacity.
- The band, stage, fallback, and canvas remain width-bounded by their route/container geometry. `100vw` breakout, negative stage overlap, route overflow masking, scroll interception, pinning, and position rewriting remain forbidden. Rendered overflow must remain zero at `320`, `390`, `768`, `1024`, and `1440` CSS px.

## Owner-approved art reset — Monumental single-side descent

Status: **APPROVED by owner, 2026-08-13**

Material/composition reference: `docs/art-direction/voleyevents-rally/e-monumental-single-side-staircase.png`

This amendment supersedes the five-equal-court overview, alternating left/right staircase, miniature-platform composition, and the frozen uncommitted candidate `c9a21f…`. The full-width band, band-owned native-scroll runway, semantic HTML order, progressive enhancement, adaptive quality, disposal, exact bundle ceiling, and physical-device gate remain authoritative.

Kanban authority: implementation `t_638fb2d7`; recertification `t_4cddcc80`.

This reset also supersedes the Obsidian amendment's `0.32–0.68` all-plane opacity range, five-plane fallback artwork, court-marking-only identity rule, implementation child/boundary, and evidence directory. It **absorbs** that unimplemented material amendment rather than stacking another renderer on top of it. The topology amendment's stale statements that the playhead remains lifecycle-bound and mobile has an automatic-height non-sticky band are superseded by committed band-owned playhead `4b69c45`.

It also supersedes the original round-one “four impact stops”, “alternating left/right depth”, “five reusable court-plane meshes”, and fallback-matrix “Full alternating court staircase” language. The implementation uses five logical monumental tread meshes and one-direction motion. In mixed test blocks, only assertions that inspect fallback object count/classes/artwork are writable; lifecycle ownership assertions remain read-only.

### Primary visual idea

- The camera lives **inside a monumental staircase**, close and low. This is not a diagram or establishing overview.
- The scene retains exactly five logical treads/contact anchors for the five authored states, but at every frame only `2–3` massive treads may be materially visible. “Materially visible” means opacity `≥0.12` and clipped projected area `≥1%` of stage area. The dominant tread is the materially visible tread with greatest clipped projected area; its clipped horizontal span must occupy at least `85%` of stage width and may leave the frame. The visible staircase union is not an acceptance proxy.
- Steps descend in **one continuous screen direction**. This does not confine the ball to one half of the stage. Across all exact and between-stop samples, projected ball-centre x must be monotonic; cumulative backward movement may not exceed `3%` of stage width. No alternating left/right or zigzag traversal.
- Background steps remain secondary: smoked-obsidian opacity `0.18–0.42`, subdued edge energy, no equally weighted floating cards. The active/dominant tread uses opacity `0.28–0.72` for contact/readability.
- Production uses renderer-native geometry, colors, lights, opacity, roughness, and warm unlit edge strips. The moodframe's marble veins, leather microtexture, photographic reflections, and environment scenery are explicitly rejected unless a later separately approved material ticket proves they earn their bytes.

### Ball scale and choreography

- Exactly one unmistakable panelled volleyball is the hero object. Its **unclipped** projected diameter stays between `38–50%` of stage width on desktop and `32–46%` on mobile at the five exact stops; it never drops below `30%` between stops. Moodframe E owns close-camera scale and lighting posture, but its photographic texture/reflection and exact pixel ratio are non-transferable.
- From the first to final exact stop, projected ball-centre displacement is at least `45%` of stage width in the one allowed x direction and at least `70%` of stage height downward. The swept silhouette therefore covers at least `83%` of stage width on desktop. Each quarter contributes at least `12%` of stage-height net downward displacement, so camera tracking cannot cancel a drop. This screen-space rule supersedes the earlier `0.8` camera-relative world-unit separation.
- Each quarter of band progress is one deterministic cycle: **slow roll across tread → short edge hesitation → gravity-like tip/drop → hard contact on next tread**. Rotation direction follows travel and reverses exactly under reverse scroll.
- Horizontal screen direction may not flip between segments. The ball's screen-space x position follows the monotonic rule above; no zigzag.
- Contact uses one short bounded vermilion glow/ring. No particles, bounce loop, screen shake, physics engine, autoplay timeline, or independent animation clock.

### Camera and composition

- Projection oracles use the production stage rectangles: desktop `1338.6×736`, mobile `328×270.9`, and short landscape `844×164` CSS px. The old fixed `42°` FOV is superseded. Desktop/mobile may use an authored `28–34°` macro lens; short landscape may use an aspect-specific profile. Tests must consume the same production FOV/profile as the renderer, and controller proof must additionally read back the live DOM rect.
- Cinematic cropping is intentional for this macro composition. On desktop/mobile, the projected ball silhouette may extend outside the stage at the first/final exact stops by at most `35%` of its area. At intermediate samples the maximum is `30%` on desktop and `18%` on mobile; diameter is always measured before clipping. Occlusion tests ignore silhouette samples outside the stage, require at least `5` in-stage samples, and require every in-stage sample to be unoccluded.
- The camera is a **fixed staircase composition**, not a ball-follow camera. Across the usable runway its position and target remain anchored to the staircase shot; the ball travels through that frame. Aspect profiles may differ, but progress may not recenter the camera on the ball or cancel the numeric screen-space route. At each exact stop, the next contact edge must have opacity `≥0.12`, clipped projected length `≥18%` of stage width, and lie fully below the ball centre.
- The five authored tread/contact centres may be retuned in `x/z` as one monotonic diagonal staircase so `2–3` distinct top+riser silhouettes remain readable behind and ahead of the macro ball. Their exact contact `y`, ordered state ownership, single screen direction, quarter timing, and reversible spin remain unchanged. No stop may alternate sides or zigzag.
- Fixed-camera feasibility supersedes the old `1.55` world-unit contact-y spacing. The five exact ball-contact centres use a uniform `0.72` world-unit downward step (`2.88` total from first to final); each tread plane remains exactly one `BALL_RADIUS` below its contact centre within `0.02`. This is the only relaxed numeric fact: projected `≥70%` desktop/mobile descent, diameter/crop bounds, ordered states, quarter choreography, one-direction travel, and reversible spin remain unchanged.
- Desktop `1440×1000`: dominant tread clipped width `≥85%`, ball diameter and route coverage use the numeric ranges above.
- Mobile `360×645` with `42svh` stage: at most two tread tops may each have clipped projected area `≥4%` of stage area; crop stays within the cinematic bounds above and may not remove the next contact edge.
- Short landscape `844×164` is an eligibility/safety fixture, not the owner art-composition target: ball diameter is `45–70%` of stage height, first-to-final x displacement is `≥35%` of stage width, y displacement is `≥25%` of stage height, silhouette crop is `≤30%`, and all in-stage occlusion/contact/one-direction/runtime-budget rules still apply. Desktop/mobile width-based diameter and `70%` y-displacement rules do not apply to short landscape.
- No semantic text appears inside or behind the band. Native-scroll states remain `serve → event-opens → player-registers → payment-matches → attendance-resolves` at `0/.25/.5/.75/1` of usable runway.

### Fallback and proof

- Static SVG/CSS fallback shows the same close camera: one enormous foreground tread, one large panelled ball, one descending edge/contact cue. It must not fall back to the five-miniature-court diagram.
- The fallback intentionally replaces the old exactly-five-plane/four-marker SVG contract. It contains exactly `2` close-up tread groups, `1` panelled ball, and `1` contact cue; no `data-rally-landing`, miniature court group, net, or repeated ball remains. Logical five-state ownership stays in the runtime/playhead, not fallback object count.
- “Exact contact” means the ball centre is one ball radius from the active tread plane within `0.02` world units at exact stops. “Unoccluded” uses nine projected silhouette samples (centre plus eight cardinal/diagonal points at `0.82×` radius) under the in-stage rule above. Tests sample exact stops plus at least `8` evenly spaced points per quarter.
- At stops `0/.25/.5/.75`, “next contact edge” means the leading contact edge of the next tread. At final stop `1`, it means the leading drop-off edge of the fifth/final tread; the same opacity, clipped-length, and below-ball-centre thresholds apply.
- Pure-frame tests must measure materially visible tread count, dominant clipped occupancy, ball diameter, monotonic one-direction path, x/y route coverage, exact contact, forward/reverse identity, opacity bounds, next-edge visibility, and between-stop occlusion on desktop/mobile/short landscape.
- Controller production-preview proof captures initial, pre-edge, mid-drop, contact, and final states. Visual failure beats tests/reviewer approval.
- Physical phone proof remains mandatory before local renderer commit. No push, deploy, MiniMax, texture/model download, or new dependency is authorized.

### Renderer budget and ownership boundary

- Each of the five logical treads is one geometry/mesh containing its top and riser, so per-tread opacity remains possible without a custom shader. All warm tread edges are merged into one existing `LineSegments`. Do not allocate separate top/riser/edge meshes per tread.
- Existing validated 18-member Three facade remains unchanged. No new constructor, loader, shader hook, model, texture, environment map, postprocessing pass, or physics dependency.
- Low remains `≤10` draw calls including a live contact cue: five tread meshes + one merged edge line + three ball draws + one contact cue. Medium remains `≤14`, High `≤18`; triangle caps and DPR profiles remain unchanged. Flat transparent double-sided tread/contact geometry uses `forceSinglePass` where applicable. Budget limits may not be raised in this ticket.
- Writable production: `src/voleyevents/rallyRuntime.ts`; fallback SVG only in `src/pages/VoleyEvents.tsx`; VoleyEvents fallback/material blocks only in `src/styles.css`.
- Writable oracles: `src/voleyevents/rallyRuntime.test.ts`; fallback-only assertions in `src/pages/voleyEvents.test.ts`; matching fallback/material assertions in `src/styles.test.ts`; generated `docs/evidence/voleyevents-rally/bundle-budget.json`.
- Read-only: `src/voleyevents/rallyQuality.ts`, `src/voleyevents/rallyPlayhead.ts`, `src/voleyevents/rallyProgress.ts`, all loaders/source closure/package metadata and unrelated route/styles/tests.
- Controller-owned recertification writes only `docs/evidence/voleyevents-rally/monumental-single-side/` plus refreshed existing `performance-matrix.json`, `browser-acceptance.md`, `tier-transitions.json`, and `bundle-budget.json`, all bound to the exact accepted candidate.
