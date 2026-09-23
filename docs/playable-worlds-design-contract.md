# Playable worlds

Status: playable-worlds implementation verified locally; this document describes the selected presentation, not deployment state.

## Decision

Promote the direction explored in `sketches/001-playable-worlds`, `002-court`, and `003-instrument` into the four existing React routes. The main action is exploring and operating the work, not reading a résumé. Sparse composition; priorities: a recognizable object/mechanic, one clear action, concise sourced context.

- `/`: warm chalk/vermilion editorial hub, native project selector and responsive object, ordinary deep links. Keep sourced side projects; Screen Switch gets a reversible display-swap illustration.
- `/gameonvb`: the live gameonvb.cz dark-purple/yellow arcade palette and its transparent pixel volleyball asset; one full-viewport court with a large directly throwable ball, parallax depth and contact energy. Preserve crisp pixel rendering instead of smoothing the 180×180 source. Serve/Reset work by keyboard/touch. Session contacts are explicitly toy feedback. Complete operational story remains semantic HTML, without needing to play. `/voleyevents` redirects here.
- `/goal-loop`: the light shape-and-hole illustration makes the brief a fixed opening, the plan a light outline and the build a solid shape. Critique compares the plan with the opening; Check tests the object on the table; Review compares it with the opening. One plan revision and two visible repair pieces bound the illustrative run. Native SVG and controls work without WebGL; reduced motion advances one step per action. No real agents/checks/deployments are invoked. Keep the primary action and return choice visible in the mobile entry viewport. Full sourced stage definitions and audited historical comparisons remain available.
- `/playground`: expressive vermilion field, not another black technical report. Keep the real progressive System Field renderer and its reversible native-scroll path. Put shape controls and a keyboard/touch pulse at the entry point. Reduced-motion/no-WebGL users get semantic navigation and visible static feedback.

## Supersession and retained authority

This direction replaces the former VoleyEvents staircase presentation and presents that operational case under the GameOnVB brand; it does not implement the formerly approved macro-camera proposal. `docs/voleyevents-rally-design-contract.md` and its evidence remain history. Remove its unused runtime/loaders and their exclusive tests/checker instead of retaining a second hidden renderer. Preserve current lifecycle content and shared navigation contracts.

The Playground contract retains native scroll ownership, reduced/no-WebGL behavior, teardown and route-local dynamic imports; its old black palette, copy/hero topology and prohibition on direct controls are superseded here. The former Goal Loop graphite workbench and renderer are superseded by the shape-and-hole scene. Do not weaken history/cost provenance tests or resurrect the retired Vitek Machine.

## Implementation boundaries

Reuse React/Vite/TypeScript, typed project data, source-safe claims, contact/CV assets, route/history/focus handling, existing Playground GSAP/Three loaders. No new dependency, framework, terminal simulation, autoplay sound, custom cursor, loader, scroll hijacking or compulsory play.

CSS/SVG owns the court and hub; React owns discrete interaction state, refs/RAF own bounded ball transforms. The Goal Loop reducer alone owns domain transitions. Its route-local SVG illustration schedules frames only during motion and cancels them on route exit, hide or interruption. Playground keeps its current renderer; direct pulse reaches its existing wave method through the controller, never synthetic pointer events.

## States and access

- All controls use native buttons/inputs/links, visible focus, targets at least 44px, and human-readable names.
- Ball: idle → drag → flight → contact → settle; cancellation/hidden/offscreen/resize/unmount stop work and preserve a usable position. Reduced motion uses immediate positions, no loop. Mouse, touch and keyboard have equivalent entry actions.
- Instrument: sequential plan/critique/build/check/review/outcome around one persistent shape. Critique returns the plan before Build; Check and Review return the same candidate to Build and share two bounded repair returns. Pass and Block are absorbing until Reset. The primary action fixes the marked place for keyboard users; direct dragging is optional. The illustrated second run is clean, controls stay native, and technical reference content uses native details without exclusive scroll jumps.
- Hub: visible selected state and normal link per world; no hidden content dependency. Display swap has repeat/undo semantics and no live desktop access.
- Field: native-scroll controls remain interruptible, pulse never changes progress; fallback gives immediate static feedback rather than a dead button.

## Verification

Each interaction leaves a focused failing-then-passing Vitest check; actual browser proof uses normal clicks, dragging, keyboard and touch input. Run full test/check/build and diff hygiene. Verify all four routes at desktop, 390px and 320px, breakpoint seams, history/refresh/fragments, focus, reduced motion, no-WebGL fallback, route teardown, console/network health and no horizontal overflow. Do not call emulation physical-phone GPU proof.

The local rebuild is done when each route uses the new presentation with a working primary interaction, source-safe content remains reachable, obsolete VoleyEvents renderer code is removed, and all available checks pass. Owner taste feedback and physical-device verification remain separate from functional acceptance.
