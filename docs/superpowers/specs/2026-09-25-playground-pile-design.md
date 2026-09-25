# Playground "Box" — 3D throwable pile — design

Status: owner-approved direction 2026-09-25. Replaces the System Field playground.

## Intent

- `/playground` is a toy. Nothing to solve. Pure play.
- Must react strongly to mouse **and** feel equally good with touch on a phone.
- Playground may be chaotic. (Homepage stays calm and focused — separate project, not in scope.)
- Reference bar: award-winning pointer-reactive sites (Bruno Simon folio, Igloo Inc, Lusion Labs, Codrops crumpled paper). Borrowed principles: one strong idea, velocity-driven force, weight + inertia, instant response then a long settle, 2–3 colours, zero UI chrome.

## Experience

- One full-viewport screen under the normal site header. No beats, no scroll story, no Flat/Fold/Tunnel buttons.
- A large transparent box (thin ink edges only) sits centred. Inside: a pile of soft, heavy objects.
  - Letters `V I T E K` (extruded, rounded, lime).
  - Volleyballs and simple shapes (spheres, rounded cubes, capsules) in ink.
  - Count: 60 total on capable devices, 30 on weak ones. Letters always present.
- Only copy on screen: small label `grab & throw · scroll to spin`, plus an optional sound toggle.

### Desktop

- Wheel / scroll spins the box around its horizontal and vertical axes (eased, with inertia). Gravity stays world-down, so the pile tumbles from wall to wall.
- Pointer down on an object grabs it (spring joint to cursor ray on a plane at object depth). Release throws with pointer velocity.
- Pointer moving fast through the pile shoves objects (kinematic sphere following the cursor; impulse scales with speed). Slow movement barely nudges.
- Double-click on empty space: radial burst from that point.
- After ~3 s with no input, letters V-I-T-E-K ease back into a readable row on the box floor (spring to target pose). Other objects stay where they fall.

### Mobile / touch

- Canvas is one screen; `touch-action: none` on the canvas only. Header nav stays normal.
- Drag starting on an object: grab + throw (same as desktop).
- Drag starting on empty space: spins the box (replaces wheel).
- Two fingers: burst between them.
- Double-tap empty space: burst.
- Tilt (device orientation) steers gravity — opt-in only, enabled by a tap on a small `tilt` chip (iOS permission prompt needs a user gesture). Never required.

### Sound

- Off by default. Toggle turns on soft collision thuds (Web Audio, volume by impact speed, rate-limited). No external audio files beyond 2–3 short samples, or synthesized.

## Look

- Background `--paper #f2efe6`. Objects `--ink #090909`, matte clay-like material. Letters `--signal #d9ff43`.
- Soft single-light shadows (one directional light + shadow map on capable tier; baked blob shadow on weak tier).
- Box edges: thin ink lines, slight transparency.

## Loading

- Rapier WASM + three are dynamically imported only on `/playground`.
- Loader screen: paper background, large monospace `0–100%` counter driven by real import progress (two steps: three, rapier; then scene build). Scene fades in when first frame is rendered.
- If WebGL or WASM fails: static fallback text + link back home. No crash.

## Performance tiers

- On start, measure ~30 frames. If average frame time > 22 ms, drop to weak tier: 30 objects, pixel ratio 1 (else `min(devicePixelRatio, 2)`), no shadow map.
- Physics fixed step 60 Hz, max 3 substeps per frame.
- Instanced meshes per object type (one draw call per type).
- Pause render + physics on `visibilitychange` hidden and when route unmounts (dispose everything).
- `prefers-reduced-motion: reduce`: no scroll spin, no bursts, grabbing still works with heavy damping; letters start in their row.

## Technical

- Render: `three` (already installed).
- Physics: add `@dimforge/rapier3d-compat` (~2 MB incl. WASM). Owner accepted size in exchange for stability and loader screen. Alternative `cannon-es` rejected (jitter with 60 bodies).
- Letter colliders: convex hulls or compound boxes per glyph — not trimesh.
- Files (target shape, keep few):
  - `src/pages/Playground.tsx` — page shell, loader UI, fallback, sound + tilt chips.
  - `src/playground/loadPileRuntime.ts` — the single dynamic-import seam for `three` + rapier (replaces `loadSystemFieldRuntime.ts`; `sourceClosure.test.ts` updated to this one path).
  - `src/playground/pileRuntime.ts` — scene, physics, input, tiers, dispose.
  - `src/playground/pileInput.ts` — pure pointer/gesture classification (grab vs spin vs burst) — unit-tested.
- Delete: System Field + Relay code in `src/playground/` (`relay*`, `systemField*`, `loadRelayRuntime*`, `loadSystemFieldRuntime*`, `documentScrollBehavior*`, `scrollOwnership*` if only used by them) and their CSS in `src/styles.css`. Keep the `gsap` dependency: `src/goal-loop/loopSceneController.ts` still expects an injected gsap. Removing it is a separate task.

## Testing

- Update `src/pages/playground.test.ts`, `src/App.test.ts` playground block, `src/styles.test.ts` playground block, `src/sourceClosure.test.ts` loader assertions to the new contract.
- Unit test `pileInput.ts` (grab vs spin vs burst decisions, velocity from samples).
- `npm run check`, `npm run build`, Vitest green.
- cmux browser proof (not Chrome CDP): desktop 1440×900 and mobile 390×844 — loader, settled pile, after grab/throw, after spin, letters re-assembled. Remember cmux hidden-window rAF gotcha: verify `document.visibilityState === 'visible'` before judging motion.

## Out of scope

- Homepage redesign (next project: calm, focused, award-style sliders / overlap).
- Multiplayer, saving/sharing states.
