# Playground 3D Pile Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Do NOT commit, push, deploy. Do NOT spawn other agents. Only touch paths listed in "Allowed paths".

**Goal:** Replace System Field `/playground` with a full-screen 3D box of throwable objects (three.js + Rapier), mouse + touch first-class, loader, perf tiers.

**Architecture:** React page shell (`Playground.tsx`) owns loader/fallback/chips and mounts a canvas. One dynamic-import seam (`loadPileRuntime.ts`) loads `three` + `@dimforge/rapier3d-compat`. `pileRuntime.ts` owns scene, physics, render loop, dispose. Pure logic (gesture classification, velocity, tier decision, letter targets) lives in `pileInput.ts` and is unit-tested.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Vitest 4, three 0.185.1, @dimforge/rapier3d-compat 0.21.0 (new).

**Spec:** `docs/superpowers/specs/2026-09-25-playground-pile-design.md` — read it fully first. It is the source of truth for behavior and look.

## Global Constraints

- Colours: background `--paper #f2efe6`, objects `--ink #090909`, letters V I T E K `--signal #d9ff43`.
- Object count: 60 capable tier, 30 weak tier. Letters always present.
- Weak tier when average of first ~30 frame times > 22 ms: 30 objects, pixel ratio 1, no shadow map. Capable: pixel ratio `min(devicePixelRatio, 2)`, shadow map on.
- Physics fixed step 1/60 s, max 3 substeps per frame.
- `touch-action: none` on the canvas only. Site header stays usable.
- Sound off by default. Tilt opt-in via tap only.
- `prefers-reduced-motion: reduce`: no scroll spin, no bursts, grab with heavy damping, letters start in row.
- `three` and rapier are imported ONLY inside `src/playground/loadPileRuntime.ts` via `import('three')` and `import('@dimforge/rapier3d-compat')` (exactly one each).
- Keep `gsap` dependency (goal-loop still references it).
- On-screen copy: `grab & throw · scroll to spin` (mobile: `grab & throw · drag to spin`).
- Browser proof uses cmux, never Chrome CDP.

## Allowed paths

- `package.json`, `package-lock.json` (add rapier only)
- `src/pages/Playground.tsx`, `src/pages/playground.test.ts`
- `src/playground/**` (delete old files, add new)
- `src/App.test.ts` (playground block only), `src/styles.test.ts` (playground/relay/system-field blocks only), `src/sourceClosure.test.ts` (playground loader assertions only)
- `src/styles.css` (remove relay/system-field rules, add pile rules)
- `src/three.d.ts` only if a declaration is needed for rapier (rapier ships its own types; prefer no change)
- Proof output dir given in the prompt

## Review Focus

1. Route change away from `/playground` mid-load or mid-play: runtime must stop and dispose (no RAF, no listeners, no WebGL context leak). Test: loader returns `canceled` after unmount; runtime `destroy()` removes listeners.
2. Touch drag starting on empty space must spin, not scroll page or grab. Test in `pileInput.test.ts`.
3. Pointer released after long hold without movement must not throw object at huge speed (velocity from last ~80 ms samples only). Test in `pileInput.test.ts`.
4. WebGL/WASM unavailable: fallback text + home link, no uncaught error. Test in `playground.test.ts` (SSR markup contains fallback container hidden until needed) + loader rejects -> status `failed`.
5. Tab hidden then shown: no huge physics catch-up jump (clamp dt, max 3 substeps). Test: `stepCount(dt)` helper in `pileInput.ts`.

---

### Task 1: Remove System Field, add dependency, new route shell

**Files:**
- Delete: `src/playground/relay*`, `src/playground/systemField*`, `src/playground/loadRelayRuntime*`, `src/playground/loadSystemFieldRuntime*`, `src/playground/documentScrollBehavior*`, `src/playground/scrollOwnership*` (grep first: delete only if nothing outside these files imports them)
- Modify: `src/pages/Playground.tsx` (rewrite), `src/pages/playground.test.ts` (rewrite), `src/App.test.ts`, `src/styles.test.ts`, `src/sourceClosure.test.ts`, `src/styles.css`, `package.json`
- Run: `npm install @dimforge/rapier3d-compat@0.21.0 --save-exact`

**Produces:** `PlaygroundPage({ onNavigate })` — same props as today (App.tsx unchanged). Markup: `<article className="playground" data-pile-state="loading|ready|failed">` containing `<div className="pile-stage" data-pile-stage>` (canvas mount), `<p className="pile-loader" data-pile-loader>` with percent, `<p className="pile-hint">`, `<div className="pile-fallback" data-pile-fallback hidden>` with text `The playground needs WebGL.` and link to `/`, chips `<button data-pile-sound>` (`Sound off`/`Sound on`) and `<button data-pile-tilt>` (`tilt`).

- [ ] Step 1: rewrite `src/pages/playground.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'

const render = (path = '/playground') =>
  renderToStaticMarkup(createElement(App, { initialPath: path }))

describe('Pile Playground', () => {
  it('renders loader, stage, hint and hidden fallback', () => {
    const markup = render()
    expect(markup).toContain('data-pile-state="loading"')
    expect(markup).toContain('data-pile-stage')
    expect(markup).toContain('data-pile-loader')
    expect(markup).toContain('grab &amp; throw')
    expect(markup).toMatch(/data-pile-fallback="[^"]*" hidden|data-pile-fallback hidden|data-pile-fallback=""[^>]*hidden/)
    expect(markup).toContain('The playground needs WebGL.')
  })

  it('starts with sound off and offers tilt as opt-in', () => {
    const markup = render()
    expect(markup).toContain('Sound off')
    expect(markup).toContain('data-pile-tilt')
  })

  it('drops the old System Field copy', () => {
    const markup = render()
    for (const gone of ['DISTURB IT.', 'Send a pulse', 'relay-beat', 'system-field']) {
      expect(markup).not.toContain(gone)
    }
  })
})
```

- [ ] Step 2: `npx vitest run src/pages/playground.test.ts` — expect FAIL.
- [ ] Step 3: rewrite `Playground.tsx` with the markup above (no runtime yet), delete old files, replace old CSS rules with `.playground` (full viewport below header, `min-height: calc(100svh - header)`), `.pile-stage` (absolute fill, `touch-action: none` on its canvas), `.pile-loader` (large monospace percent, centred), `.pile-hint`, `.pile-fallback`, chips. Update `App.test.ts` playground block to assert `data-pile-stage` on `/playground` and `/playground/`. Replace relay/system-field assertions in `styles.test.ts` with: `.pile-stage canvas` has `touch-action: none`; mobile media query keeps `.pile-hint` visible. Update `sourceClosure.test.ts` loader assertions per Task 2 Produces (`./playground/loadPileRuntime.ts` is the only importer of `three` and of `@dimforge/rapier3d-compat`, one dynamic import each; `gsap` assertion: update the expected importer list to whatever remains, or `[]` if none — keep the dependency in package.json).
- [ ] Step 4: `npm test && npm run check` — PASS (sourceClosure may need Task 2 file; if so create `loadPileRuntime.ts` stub from Task 2 now).

### Task 2: Runtime loader seam

**Files:** Create `src/playground/loadPileRuntime.ts`, `src/playground/loadPileRuntime.test.ts`

**Produces:**
```ts
export type PileLoadResult<R> =
  | { status: 'created'; runtime: R }
  | { status: 'canceled' }
  | { status: 'failed'; error: unknown }

export interface PileLoadRequest<R> {
  isCanceled: () => boolean
  onProgress: (percent: number) => void          // 0..100, monotonic
  importThree?: () => Promise<unknown>             // test seam
  importRapier?: () => Promise<{ init: () => Promise<void> } & Record<string, unknown>>
  createRuntime: (three: unknown, rapier: unknown) => R | Promise<R>
}

export function loadPileRuntime<R>(req: PileLoadRequest<R>): Promise<PileLoadResult<R>>
```
Progress steps: 0 start, 40 after three, 80 after rapier `init()`, 100 after `createRuntime`. Never throws; returns `failed`. Returns `canceled` if `isCanceled()` true after any await.

- [ ] Step 1: test file:

```ts
import { describe, expect, it } from 'vitest'
import { loadPileRuntime } from './loadPileRuntime'

const ok = () => ({
  importThree: async () => ({ three: true }),
  importRapier: async () => ({ init: async () => {} }),
})

describe('loadPileRuntime', () => {
  it('reports monotonic progress and creates runtime', async () => {
    const seen: number[] = []
    const result = await loadPileRuntime({
      ...ok(), isCanceled: () => false, onProgress: (p) => seen.push(p),
      createRuntime: () => 'rt',
    })
    expect(result).toEqual({ status: 'created', runtime: 'rt' })
    expect(seen).toEqual([0, 40, 80, 100])
  })

  it('returns canceled when unmounted mid-load', async () => {
    let canceled = false
    const result = await loadPileRuntime({
      importThree: async () => { canceled = true; return {} },
      importRapier: async () => ({ init: async () => {} }),
      isCanceled: () => canceled, onProgress: () => {},
      createRuntime: () => { throw new Error('must not create') },
    })
    expect(result).toEqual({ status: 'canceled' })
  })

  it('returns failed instead of throwing when WASM init fails', async () => {
    const result = await loadPileRuntime({
      importThree: async () => ({}),
      importRapier: async () => ({ init: async () => { throw new Error('no wasm') } }),
      isCanceled: () => false, onProgress: () => {}, createRuntime: () => 'rt',
    })
    expect(result.status).toBe('failed')
  })
})
```
- [ ] Step 2: run, FAIL. Step 3: implement (default imports: `() => import('three')`, `() => import('@dimforge/rapier3d-compat').then((m) => m.default ?? m)`). Step 4: run, PASS.

### Task 3: Pure input + timing logic

**Files:** Create `src/playground/pileInput.ts`, `src/playground/pileInput.test.ts`

**Produces:**
```ts
export type Gesture = 'grab' | 'spin' | 'burst' | 'none'
export interface PointerSample { x: number; y: number; t: number } // px, ms
export function classifyPointerDown(args: { hitObject: boolean; pointerType: 'mouse' | 'touch' | 'pen'; activePointers: number; isDoubleTap: boolean }): Gesture
export function isDoubleTap(prev: PointerSample | null, next: PointerSample): boolean // <300 ms, <24 px
export function releaseVelocity(samples: readonly PointerSample[], now: number): { vx: number; vy: number } // px/s, only samples within last 80 ms; zero if none
export function stepCount(dtSeconds: number, step?: number, maxSteps?: number): number // fixed 1/60, clamp to 3
export function pickTier(frameTimesMs: readonly number[]): 'capable' | 'weak' // average > 22 => weak
export function letterTargets(count: 5, spacing: number): Array<{ x: number; y: number; z: number }> // centred row on floor
```
Rules: `activePointers >= 2` -> `burst`. `isDoubleTap && !hitObject` -> `burst`. `hitObject` -> `grab`. Else: `touch`/`pen` -> `spin`; `mouse` -> `none` (mouse spins via wheel; mouse movement shoves via kinematic sphere). Mouse double-click on empty space -> `burst` via the `isDoubleTap` rule.

- [ ] Step 1: test file:

```ts
import { describe, expect, it } from 'vitest'
import { classifyPointerDown, isDoubleTap, releaseVelocity, stepCount, pickTier, letterTargets } from './pileInput'

describe('classifyPointerDown', () => {
  const base = { hitObject: false, pointerType: 'touch' as const, activePointers: 1, isDoubleTap: false }
  it('touch on empty space spins', () => expect(classifyPointerDown(base)).toBe('spin'))
  it('touch on object grabs', () => expect(classifyPointerDown({ ...base, hitObject: true })).toBe('grab'))
  it('two fingers burst', () => expect(classifyPointerDown({ ...base, activePointers: 2 })).toBe('burst'))
  it('double tap on empty bursts', () => expect(classifyPointerDown({ ...base, isDoubleTap: true })).toBe('burst'))
  it('mouse on empty does nothing', () => expect(classifyPointerDown({ ...base, pointerType: 'mouse' })).toBe('none'))
})

describe('isDoubleTap', () => {
  it('near and fast', () => expect(isDoubleTap({ x: 0, y: 0, t: 0 }, { x: 10, y: 5, t: 200 })).toBe(true))
  it('too slow', () => expect(isDoubleTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 400 })).toBe(false))
  it('too far', () => expect(isDoubleTap({ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 100 })).toBe(false))
})

describe('releaseVelocity', () => {
  it('uses recent samples', () => {
    const v = releaseVelocity([{ x: 0, y: 0, t: 920 }, { x: 50, y: 0, t: 970 }], 1000)
    expect(v.vx).toBeCloseTo(1000); expect(v.vy).toBe(0)
  })
  it('long hold without movement throws nothing', () => {
    expect(releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 300, y: 0, t: 50 }], 2000)).toEqual({ vx: 0, vy: 0 })
  })
})

describe('stepCount', () => {
  it('one step at 60 fps', () => expect(stepCount(1 / 60)).toBe(1))
  it('clamps after tab was hidden', () => expect(stepCount(5)).toBe(3))
  it('zero for zero dt', () => expect(stepCount(0)).toBe(0))
})

describe('pickTier', () => {
  it('fast device capable', () => expect(pickTier(Array(30).fill(12))).toBe('capable'))
  it('slow device weak', () => expect(pickTier(Array(30).fill(30))).toBe('weak'))
})

describe('letterTargets', () => {
  it('centred row of five', () => {
    const t = letterTargets(5, 2)
    expect(t).toHaveLength(5)
    expect(t[0].x + t[4].x).toBeCloseTo(0)
    expect(new Set(t.map((p) => p.y)).size).toBe(1)
  })
})
```
Note `stepCount` needs an accumulator in the runtime; the pure helper returns `min(maxSteps, floor(dt / step + 1e-6))` and the runtime carries the remainder (drop remainder when clamped).
- [ ] Step 2 FAIL, Step 3 implement, Step 4 PASS.

### Task 4: Pile runtime (scene, physics, input, tiers, dispose)

**Files:** Create `src/playground/pileRuntime.ts`, `src/playground/pileRuntime.test.ts` (dispose/listener test with fakes only).

**Consumes:** Task 3 helpers. `three`, `rapier` passed in (typed `any` via local minimal interfaces; do not import them statically).

**Produces:**
```ts
export interface PileRuntime {
  setSound(on: boolean): void
  enableTilt(): Promise<boolean>   // requests DeviceOrientationEvent permission on iOS; false if denied/unavailable
  destroy(): void                  // cancels RAF, removes all listeners, disposes geometries/materials/renderer, frees rapier world
}
export function createPileRuntime(three: any, rapier: any, opts: { host: HTMLElement; reducedMotion: boolean; onFirstFrame: () => void }): PileRuntime
```
Behaviour (all from spec, implement exactly):
- Orthographic-ish perspective camera looking at a box ~ viewport-fit; box = 6 static cuboid walls in a Rapier fixed body group whose rotation is set kinematically each frame from spin state (use `kinematicPositionBased` body with `setNextKinematicRotation`). Gravity world `(0,-9.81,0)`, or tilt vector when enabled.
- Objects: `InstancedMesh` per type (sphere, rounded box via `RoundedBoxGeometry` from `three/examples/jsm/geometries/RoundedBoxGeometry.js` if available — else plain `BoxGeometry`, capsule `CapsuleGeometry`, volleyball = ink sphere with paper-coloured seam lines from a small canvas texture). Letters: `TextGeometry` is heavy — use extruded `Shape`s built from a tiny hardcoded path per letter (V, I, T, E, K are straight-line glyphs; build them from rectangles/polygons), colliders = compound cuboids per glyph stroke.
- Material: `MeshStandardMaterial` roughness 0.85, metalness 0; ink / lime colours. One `DirectionalLight` (castShadow on capable tier) + `HemisphereLight`.
- Input: pointer events on canvas; raycast for `hitObject`; `grab` = spring impulse toward cursor point on plane at object depth each step; release applies `releaseVelocity` scaled to world units. Mouse move: kinematic ball collider follows cursor; its velocity shoves objects. Wheel: spin velocity += deltaY/deltaX (with `preventDefault` on wheel only over the canvas, `passive: false`). Touch `spin`: drag delta -> spin velocity. `burst`: radial impulse from point, magnitude ~ 6 units, radius ~ 3.
- Spin has inertia (velocity damped 0.92/frame) and eases; reduced motion ignores spin and burst.
- Idle 3 s without input: letters get spring toward `letterTargets` on box floor (in box-local space) and upright rotation; any input cancels.
- Sound: Web Audio, synthesized short thud (noise burst through lowpass) on contact force events above threshold, gain by force, max 8 per second. `AudioContext` created on first `setSound(true)` only.
- Tiers: render first 30 frames at capable settings, collect frame times, `pickTier`; on `weak` remove 30 non-letter bodies, set pixel ratio 1, disable shadow map.
- `visibilitychange` hidden -> pause loop; visible -> resume with `lastTime = now` (no catch-up).
- Resize via `ResizeObserver` on host.
- Call `onFirstFrame` after first render.

- [ ] Step 1: `pileRuntime.test.ts` — with fake `three`/`rapier` stubs is too costly; instead test only that `destroy()` removes every listener it added: spy `host.addEventListener`/`removeEventListener`, `window.addEventListener`/`removeEventListener`, `document.addEventListener`/`removeEventListener` and assert add/remove counts match per event name. Build the runtime via an exported `attachPileInput(host, handlers)` (Task 4 internal helper, exported for test) that returns a detach function — test that function in jsdom-free way using a minimal EventTarget (`new EventTarget()` exists in Node).
- [ ] Step 2 FAIL, Step 3 implement runtime + `attachPileInput`, Step 4 PASS, `npm run check` PASS.

### Task 5: Wire page to runtime

**Files:** Modify `src/pages/Playground.tsx`.

- `useEffect`: `loadPileRuntime({ isCanceled, onProgress: setPercent, createRuntime: (t, r) => createPileRuntime(t, r, { host: stage, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, onFirstFrame: () => setState('ready') }) })`. On `failed` -> state `failed`, show fallback (remove `hidden`), keep header working. Cleanup: set canceled, `runtime?.destroy()`.
- Also mark `failed` if `document.createElement('canvas').getContext('webgl2') ?? getContext('webgl')` is null before loading.
- Loader fades out (CSS opacity transition 400 ms) when `ready`.
- Sound chip toggles `runtime.setSound`, label `Sound off`/`Sound on`, `aria-pressed`.
- Tilt chip calls `runtime.enableTilt()`; hide chip if `DeviceOrientationEvent` undefined (client-side only; SSR renders it).
- Hint text switches to `drag to spin` when `matchMedia('(pointer: coarse)')` matches.

- [ ] Run `npm test && npm run check && npm run build` — all PASS.

### Task 6: Browser proof (cmux)

- Start dev server on a free port (e.g. `npx vite --port 4190 --strictPort`), in background; kill it at the end.
- Write `src/playground/…` nothing; write proof script in proof dir only (python or sh using `cmux browser`). Before judging motion check `document.visibilityState === 'visible'` via `cmux browser <surface> eval`.
- Screenshots to proof dir: desktop 1440×900 and mobile 390×844 (set viewport via window size or `eval` meta emulation as cmux allows; if viewport cannot be set, report it): `loader`, `settled`, `after-throw` (synthesize pointerdown/move/up via `eval` dispatching `PointerEvent`s on the canvas over a hit object), `after-spin` (wheel events), `letters-row` (wait 4 s idle).
- Record console errors (must be zero) and average FPS over 3 s via `eval` RAF counter.

## Final checks (worker runs, orchestrator re-runs)

`npm test`, `npm run check`, `npm run build`, `git diff --check`, and `git status --short` limited to allowed paths.
