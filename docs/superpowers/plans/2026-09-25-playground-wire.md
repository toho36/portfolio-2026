# Playground Hot Wire Implementation Plan

> **For agentic workers:** Implement task-by-task, TDD where tests are given. No commit, push, deploy. No other agents. Only "Allowed paths".

**Goal:** `/playground` becomes a 3D buzz-wire game along a VITEK-shaped wire, Easy (auto-rotate) and Hard (manual rotate; mobile two-finger twist), local highscores.

**Architecture:** Pure logic in `wirePath.ts` (geometry), `wireRules.ts` (collision, progress, rotation), `wireScore.ts` (storage) — all unit-tested. `wireRuntime.ts` owns three.js scene, input, camera, sound, loop, dispose. One dynamic-import seam `loadWireRuntime.ts`. `Playground.tsx` owns DOM HUD and loader/fallback.

**Tech Stack:** React 19, Vite 8, TS 7, Vitest 4, three 0.185.1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-25-playground-wire-design.md` — read fully first; it is the source of truth for behaviour, numbers and copy.

## Global Constraints

- Colours: paper `#f2efe6`, ink `#090909`, signal `#d9ff43` (use existing CSS vars `--paper`, `--ink`, `--signal`).
- Loop offset from grip: mouse `(0,-70px)`, touch `(0,-110px)`. Grip hit radius 40 px.
- Collision: fail when `|d| > innerRadius − wireRadius − innerRadius·|sin α|·MISALIGN_K`, `MISALIGN_K = 1.0`. Hazard/non-local: fail when distance < `innerRadius + wireRadius`. Sub-sample movement at step ≤ wireRadius. Progress window ±3 × loop outer radius.
- Easy rotation time constant ~80 ms. Hard: wheel ≈ 6°/notch, Q/E 180°/s, touch twist = delta angle of finger1→finger2.
- Storage keys: `vitek-wire:easy`, `vitek-wire:hard` → `{ bestPercent, bestTimeMs }`; `vitek-wire:sound`.
- Fail: beep square ~220 Hz 180 ms, red flash, shake (not with reduced motion), 600 ms freeze, back to START.
- `three` imported only in `src/playground/loadWireRuntime.ts`, exactly one `import('three')`.
- `touch-action: none` on the canvas only.
- cmux proof only: `npx vite --host 127.0.0.1 --port 4183 --strictPort`, URL `http://127.0.0.1:4183/playground` (cmux cannot load port 4190). Check `document.visibilityState === 'visible'` before judging motion.

## Allowed paths

`package.json`, `package-lock.json`, `src/pages/Playground.tsx`, `src/pages/playground.test.ts`, `src/playground/**`, `src/App.test.ts` (playground block), `src/styles.test.ts` (playground block), `src/sourceClosure.test.ts` (playground loader assertions), `src/styles.css`, proof dir from prompt.

## Review Focus

1. Fast flick of the mouse across two strokes must fail, not teleport (sub-sampling + progress window). Test in `wireRules.test.ts`.
2. Regrab far from the grip after pause must not move the loop (40 px rule). Test in `wireRules.test.ts` (`canRegrab`).
3. Corrupt `localStorage` JSON or storage throwing (Safari private) must not crash. Test in `wireScore.test.ts`.
4. Hard mode twist angle wrap across ±180° must not spin the loop by ~360°. Test in `wireRules.test.ts`.
5. Route change mid-load / mid-run: loader returns `canceled`, runtime `destroy()` removes all listeners and cancels RAF. Test in `loadWireRuntime.test.ts` and listener-balance test in `wireRuntime.test.ts`.

---

### Task 1: Base from stash, remove pile

- [ ] `git stash apply stash@{0}` (apply, NOT pop — stash must remain).
- [ ] `npm ci` if `node_modules` missing, then `npm uninstall @dimforge/rapier3d-compat`.
- [ ] Delete `src/playground/pileRuntime*`, `src/playground/pileInput*`. Rename `loadPileRuntime.ts` → `loadWireRuntime.ts` (+ test): remove rapier; progress steps `0, 60 after three, 100 after createRuntime`.

```ts
export type WireLoadResult<R> =
  | { status: 'created'; runtime: R } | { status: 'canceled' } | { status: 'failed'; error: unknown }
export interface WireLoadRequest<R> {
  isCanceled: () => boolean
  onProgress: (percent: number) => void
  importThree?: () => Promise<unknown>
  createRuntime: (three: unknown) => R | Promise<R>
}
export function loadWireRuntime<R>(req: WireLoadRequest<R>): Promise<WireLoadResult<R>>
```
Tests: monotonic `[0, 60, 100]` + created; canceled after await; import rejection → `failed`, never throws.
- [ ] Update `sourceClosure.test.ts`: only `./playground/loadWireRuntime.ts` imports `three`; no module imports rapier.
- [ ] `npm test && npm run check` green (Playground.tsx may temporarily render a placeholder stage).

### Task 2: `wirePath.ts` (pure)

```ts
export interface Vec2 { x: number; y: number }
export interface WirePath {
  points: readonly Vec2[]        // dense polyline after corner rounding, world units
  cumulative: readonly number[]  // arc length at each point
  length: number
  hazards: readonly (readonly [Vec2, Vec2])[] // static rods (segments)
  start: Vec2; finish: Vec2
}
export const LOOP = { innerRadius: 0.22, outerRadius: 0.3, wireRadius: 0.05 } // world units; tune only here
export function buildVitekPath(): WirePath
export function pointAt(path: WirePath, s: number): { p: Vec2; tangent: Vec2 }
export function nearestInWindow(path: WirePath, q: Vec2, sCenter: number, window: number): { s: number; p: Vec2; tangent: Vec2; distance: number; signed: number }
```
Design the VITEK control points yourself (one continuous curve + hazard rods, per spec). Tests:

```ts
import { describe, expect, it } from 'vitest'
import { buildVitekPath, nearestInWindow, pointAt, LOOP } from './wirePath'

const path = buildVitekPath()
const segDist = (p, a, b) => { const dx=b.x-a.x, dy=b.y-a.y; const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))); return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy) }

describe('buildVitekPath', () => {
  it('is continuous with monotonic arc length', () => {
    for (let i = 1; i < path.points.length; i++) {
      expect(path.cumulative[i]).toBeGreaterThan(path.cumulative[i - 1])
      expect(Math.hypot(path.points[i].x - path.points[i-1].x, path.points[i].y - path.points[i-1].y)).toBeLessThan(LOOP.wireRadius * 2)
    }
  })
  it('keeps non-adjacent parts at least 3 loop radii apart', () => {
    const min = 3 * LOOP.outerRadius
    const step = 7
    for (let i = 0; i < path.points.length; i += step)
      for (let j = i + step; j < path.points.length; j += step)
        if (path.cumulative[j] - path.cumulative[i] > 4 * min)
          expect(Math.hypot(path.points[i].x - path.points[j].x, path.points[i].y - path.points[j].y)).toBeGreaterThanOrEqual(min)
  })
  it('keeps hazard rods clear of the path', () => {
    for (const [a, b] of path.hazards)
      for (let i = 0; i < path.points.length; i += 3)
        expect(segDist(path.points[i], a, b)).toBeGreaterThanOrEqual(3 * LOOP.outerRadius)
  })
})

describe('nearestInWindow', () => {
  it('finds the point under a query on the wire', () => {
    const { p } = pointAt(path, path.length / 3)
    const n = nearestInWindow(path, p, path.length / 3, 1)
    expect(n.distance).toBeLessThan(1e-3)
    expect(Math.abs(n.s - path.length / 3)).toBeLessThan(0.05)
  })
  it('ignores parts of the path outside the window', () => {
    const far = pointAt(path, path.length * 0.9).p
    const n = nearestInWindow(path, far, 0, 1)
    expect(n.s).toBeLessThanOrEqual(1 + 1e-6)
  })
})
```
The "3 radii apart" test is a readability guard; if a letter really cannot meet it, move that stroke to a hazard rod — do not weaken the test.

### Task 3: `wireRules.ts` (pure)

```ts
import type { Vec2, WirePath } from './wirePath'
export const MISALIGN_K = 1.0
export type StepResult = { ok: true; s: number; maxS: number; finished: boolean } | { ok: false; reason: 'wire' | 'hazard' | 'jump' }
export function checkStep(path: WirePath, from: Vec2, to: Vec2, thetaFrom: number, thetaTo: number, s: number, maxS: number): StepResult // sub-samples internally
export function clearance(d: number, alpha: number): number // innerRadius − wireRadius − innerRadius·|sin α|·K − |d|  (<0 = touch)
export function easeAngle(current: number, target: number, dtMs: number, tauMs?: number): number // shortest-path, axis-symmetric (θ ≡ θ+π)
export function twistDelta(prevA: Vec2, prevB: Vec2, a: Vec2, b: Vec2): number // wrapped to (-π, π]
export function canRegrab(grip: Vec2, pointer: Vec2, radiusPx?: number): boolean // default 40
```
Tests (write all, run red, implement, run green):

```ts
import { describe, expect, it } from 'vitest'
import { buildVitekPath, pointAt, LOOP } from './wirePath'
import { checkStep, clearance, easeAngle, twistDelta, canRegrab } from './wireRules'

const path = buildVitekPath()
const angleOf = (t) => Math.atan2(t.y, t.x)

describe('clearance', () => {
  it('aligned and centred has full clearance', () => expect(clearance(0, 0)).toBeCloseTo(LOOP.innerRadius - LOOP.wireRadius))
  it('lateral offset touches', () => expect(clearance(LOOP.innerRadius, 0)).toBeLessThan(0))
  it('misalignment touches', () => expect(clearance(0, Math.PI / 3)).toBeLessThan(0))
})

describe('checkStep', () => {
  it('moving along the wire aligned is ok and advances', () => {
    const a = pointAt(path, 1), b = pointAt(path, 1.1)
    const r = checkStep(path, a.p, b.p, angleOf(a.tangent), angleOf(b.tangent), 1, 1)
    expect(r.ok).toBe(true); if (r.ok) expect(r.s).toBeGreaterThan(1)
  })
  it('flick across to a far part of the wire fails (no teleport)', () => {
    const a = pointAt(path, 1), b = pointAt(path, path.length * 0.6)
    expect(checkStep(path, a.p, b.p, angleOf(a.tangent), angleOf(b.tangent), 1, 1).ok).toBe(false)
  })
  it('stepping sideways off the wire fails', () => {
    const a = pointAt(path, 1)
    const side = { x: a.p.x - a.tangent.y * LOOP.innerRadius * 1.2, y: a.p.y + a.tangent.x * LOOP.innerRadius * 1.2 }
    expect(checkStep(path, a.p, side, angleOf(a.tangent), angleOf(a.tangent), 1, 1).ok).toBe(false)
  })
  it('reaching the end reports finished', () => {
    const a = pointAt(path, path.length - 0.05), b = pointAt(path, path.length)
    const r = checkStep(path, a.p, b.p, angleOf(a.tangent), angleOf(b.tangent), path.length - 0.05, path.length - 0.05)
    expect(r.ok && r.finished).toBe(true)
  })
})

describe('easeAngle', () => {
  it('treats θ and θ+π as the same loop orientation', () => expect(Math.abs(easeAngle(0, Math.PI, 1000))).toBeLessThan(1e-3))
})

describe('twistDelta', () => {
  it('wraps across ±180°', () => {
    const d = twistDelta({ x: 0, y: 0 }, { x: -1, y: 0.01 }, { x: 0, y: 0 }, { x: -1, y: -0.01 })
    expect(Math.abs(d)).toBeLessThan(0.05)
  })
})

describe('canRegrab', () => {
  it('near grip ok', () => expect(canRegrab({ x: 0, y: 0 }, { x: 30, y: 0 })).toBe(true))
  it('far away refused', () => expect(canRegrab({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(false))
})
```

### Task 4: `wireScore.ts` (pure, storage injected)

```ts
export type Mode = 'easy' | 'hard'
export interface Best { bestPercent: number; bestTimeMs: number | null }
export function readBest(storage: Pick<Storage, 'getItem'> | null, mode: Mode): Best
export function recordRun(storage: Pick<Storage, 'getItem' | 'setItem'> | null, mode: Mode, percent: number, timeMs: number | null): Best // timeMs only when finished
```
Tests: default `{0, null}`; corrupt JSON → default; `getItem` throwing → default; `setItem` throwing → returns merged best without throwing; best percent keeps max; best time keeps min; modes independent.

### Task 5: `wireRuntime.ts`

```ts
export interface WireRuntimeHud { onProgress(percent: number): void; onFail(): void; onFinish(timeMs: number): void; onHold(holding: boolean): void }
export interface WireRuntime { setMode(m: Mode): void; setSound(on: boolean): void; restart(): void; destroy(): void }
export function createWireRuntime(three: any, opts: { host: HTMLElement; reducedMotion: boolean; hud: WireRuntimeHud; onFirstFrame(): void }): WireRuntime
export function attachWireInput(target: EventTarget, handlers: Record<string, (e: Event) => void>): () => void // exported for listener-balance test
```
Implement per spec: TubeGeometry along `path.points` (CatmullRom from points is fine), hazard rods as tubes, START/FINISH posts, oval torus loop (scale torus X by ~1.6), wand (cylinder + grip), DirectionalLight + shadow on paper plane, slight camera tilt. Pointer mapping screen → world plane z=0; loop = grip + offset (px → world). Per frame: `checkStep` with previous/next loop pose; Easy: θ via `easeAngle` toward nearest tangent; Hard: wheel/Q/E/twist. Fail sequence and sound per spec (Web Audio, created on first grab). Camera framing rule per spec (fit whole word vs follow at loop ≈ 56 CSS px). Tier drop after 30 frames > 22 ms avg. `visibilitychange` pause/resume without catch-up. `ResizeObserver`. Dispose all on `destroy()`.
Test `wireRuntime.test.ts`: `attachWireInput(new EventTarget(), {pointerdown, pointermove, wheel})` — detach removes all (dispatch after detach does not call handlers).

### Task 6: `Playground.tsx` + CSS

- Markup: `<article class="playground" data-wire-state="loading|ready|failed">`, `.wire-stage` (canvas host), `.wire-loader` percent, HUD: segmented `Easy | Hard` (`aria-pressed`), progress `NN %`, `best NN % · m:ss.s`, sound toggle (`Sound on`/`Sound off`), hint (`click the handle` / touch `grab the handle`; Hard adds `wheel or Q/E to rotate` / `second finger to rotate`), result panel on finish with `Play again`, fallback `The playground needs WebGL.` + home link (hidden until failed). Mobile minimap bar (progress along word).
- Wire runtime via `loadWireRuntime`; cleanup cancels + destroys. HUD values from `WireRuntimeHud`; best from `wireScore`.
- CSS: remove pile rules, add wire rules; canvas `touch-action: none`; HUD fits 390 px wide without overlap.
- Rewrite `playground.test.ts`: SSR contains `data-wire-state="loading"`, `Easy`, `Hard`, `click the handle` or `grab the handle`, fallback text, and no `DISTURB IT.` / `data-pile`. Update `App.test.ts`, `styles.test.ts` accordingly.

### Task 7: cmux proof

Proof dir from prompt. Screenshots: idle, holding mid-V (dispatch PointerEvents from grip along `pointAt` samples mapped to screen — expose `window.__wireDebug = { worldToScreen, pathLength }` ONLY when `import.meta.env.DEV`), fail flash, finish (easy), hard mode HUD, narrow viewport. FPS over 3 s, console errors (must be 0).

## Final checks

`npm test`, `npm run check`, `npm run build`, `git diff --check`, `git status --short` within allowed paths, `git stash list` still shows "playground box pile WIP".
