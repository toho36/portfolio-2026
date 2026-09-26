# Homepage Poster Slider Implementation Plan

> **For agentic workers:** Implement task-by-task, TDD where tests are given. No commit, push, deploy. No other agents. Only "Allowed paths".

**Goal:** Replace `src/pages/Home.tsx` with a premium full-screen poster slider (00 hero + 6 posters), WebGL visuals with velocity bend, overlap transitions, loader, shared-element route transition; fully usable without WebGL and on touch.

**Architecture:** Copy lives in `src/content/homePosters.ts`. Pure math in `src/home/sliderMath.ts`. DOM slider controller `src/home/sliderController.ts` (inputs, snap, overlap CSS vars, a11y). WebGL in `src/home/posterRuntime.ts` behind one dynamic-import seam `src/home/loadPosterRuntime.ts`. Page `Home.tsx` renders semantic SSR markup and wires controller + runtime + loader.

**Tech Stack:** React 19, Vite 8, TS 7, Vitest 4, three 0.185.1, gsap 3.15.0 (both installed). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-homepage-poster-slider-design.md` — read fully; it holds final copy, colours, easing, numbers.

**Base:** branch from `feat/playground-hot-wire` (contains the playground; `sourceClosure.test.ts` three-import assertions must allow exactly two seams: `./playground/loadWireRuntime.ts` and `./home/loadPosterRuntime.ts`).

## Global Constraints

- Copy exactly as in spec "Copy (final)". No "AI" in any heading. Never output "independent software systems builder", "in use", or a location.
- Colours/easing/type values exactly as spec "Visual system".
- `three` imported only via `import('three')` in the two seams. `gsap` only via dynamic import in `src/home/loadPosterRuntime.ts` or existing modules.
- Touch uses native horizontal `scroll-snap-type: x mandatory`; no scroll hijack on touch.
- Works without JS/WebGL: SSR markup contains all copy and links.
- `prefers-reduced-motion`: no bend, cross-fade, instant loader hand-off, static grain.
- cmux proof only, server `npx vite --host 127.0.0.1 --port 4183 --strictPort` (port 4190 does not load in cmux).

## Allowed paths

`src/pages/Home.tsx`, `src/content/homePosters.ts`, `src/content/routes.ts` (home entry only), `src/content/systems.ts` (HERO only if still referenced), `src/home/**`, `src/styles.css` (home rules, grain, scrollbar, selection, focus), `src/App.tsx` (only for View Transitions navigation hook + 404 copy), `src/App.test.ts` (home + 404 blocks), `src/styles.test.ts` (home blocks), `src/sourceClosure.test.ts` (seam assertions), `src/pages/*.test.ts` for home, `index.html` (font preload only), proof dir from prompt.

## Review Focus

1. Trackpad wheel with many tiny deltas must advance exactly one poster per gesture, not skip several. Test in `sliderMath.test.ts` (`wheelIntent` accumulator with threshold + cooldown).
2. Resize/orientation change mid-slider keeps the same active poster. Test: `indexFromOffset` after width change.
3. Keyboard focus inside a poster link must not be trapped; Tab moves to next poster link and the slider follows focus. Test in SSR/DOM test or controller unit with a fake element list.
4. Clicking a poster while dragging must not navigate (drag distance > 6 px cancels click). Test `isClick(distance)`.
5. Route change during loader/import: loader canceled, runtime destroyed, no RAF left. Test in `loadPosterRuntime.test.ts`.

---

### Task 1: Content + SSR skeleton + CSS slider

**Files:** Create `src/content/homePosters.ts`, `src/content/homePosters.test.ts`. Rewrite `src/pages/Home.tsx`. Modify `src/styles.css`, `src/content/routes.ts`, `src/App.test.ts`.

```ts
export interface Poster {
  index: string                 // '00'..'06'
  id: 'hero' | 'gameonvb' | 'solidpixels' | 'goal-loop' | 'playground' | 'tools' | 'contact'
  label: string                 // mono label e.g. 'GameOnVB'
  heading: string
  body: string
  accent: string                // hex
  href?: string                 // internal route or external URL; absent = non-link
  external?: boolean
}
export const POSTERS: readonly Poster[]
export const HOME_COPY: { role: string; positioning: string; hintDesktop: string; hintTouch: string; cta: string; contactCta: string; loader: string }
```
Tests (`homePosters.test.ts`):
```ts
import { describe, expect, it } from 'vitest'
import { POSTERS, HOME_COPY } from './homePosters'

describe('home posters', () => {
  it('has 7 posters in order', () => {
    expect(POSTERS.map((p) => p.id)).toEqual(['hero', 'gameonvb', 'solidpixels', 'goal-loop', 'playground', 'tools', 'contact'])
    expect(POSTERS.map((p) => p.index)).toEqual(['00', '01', '02', '03', '04', '05', '06'])
  })
  it('uses the approved headings', () => {
    expect(POSTERS.map((p) => p.heading)).toEqual([
      'New tools. Old standards.', 'Operations, made quiet.', 'Shared codebases, shared standards.',
      'Speed with hard checks.', 'Interaction, studied closely.', 'Small tools, finished properly.', "Let's talk about your project.",
    ])
  })
  it('never says AI in headings and avoids banned claims', () => {
    for (const p of POSTERS) expect(p.heading).not.toMatch(/\bAI\b/)
    const all = JSON.stringify({ POSTERS, HOME_COPY }).toLowerCase()
    for (const banned of ['independent software systems builder', 'in use', 'czech']) expect(all).not.toContain(banned)
  })
  it('links only where approved', () => {
    const byId = Object.fromEntries(POSTERS.map((p) => [p.id, p.href]))
    expect(byId).toMatchObject({ gameonvb: '/gameonvb', 'goal-loop': '/goal-loop', playground: '/playground' })
    expect(byId.solidpixels).toBeUndefined()
  })
})
```
Home SSR: `<main class="home-slider" data-home-state="loading">` → `<ol class="poster-track">` of `<li><article class="poster" data-poster={id} style="--accent:…">` with mono index/label, `<h2>` (hero uses `<h1>`), body, link (`View project` / Suburbs external / contact links from `CONTACT`), `.poster-visual` empty slot. Hint element with both hint texts (CSS shows per `(pointer: coarse)`). `aria-live` region. CSS: full-viewport, horizontal `scroll-snap-type: x mandatory`, each poster `100vw × 100svh`, grid 12/4 cols, type scale and colours from spec, grain overlay, scrollbar/selection/focus styles.
Update `App.test.ts` home block to new copy. Update routes home title `Hoang Viet To — Software Developer`, description = positioning line.
- [ ] Red → implement → `npm test && npm run check` green.

### Task 2: `src/home/sliderMath.ts` (pure)

```ts
export function indexFromOffset(offset: number, width: number, count: number): number   // round, clamped
export function snapTarget(offset: number, velocity: number, width: number, count: number): number // index; |velocity| > 0.5 px/ms moves one in its direction
export function bendFromVelocity(velocity: number, max?: number): number                 // px/ms → [-max, max], default max 0.35, smooth (tanh)
export function overlapState(progress: number): { outScale: number; outDim: number; inX: number } // progress 0..1 → outScale 1→0.92, outDim 1→0.6, inX 1→0 (fraction of width)
export function createWheelIntent(opts?: { threshold?: number; cooldownMs?: number }): (deltaY: number, deltaX: number, now: number) => -1 | 0 | 1 // threshold 60, cooldown 650
export function isClick(dragDistancePx: number): boolean                                 // <= 6
```
Tests:
```ts
import { describe, expect, it } from 'vitest'
import { indexFromOffset, snapTarget, bendFromVelocity, overlapState, createWheelIntent, isClick } from './sliderMath'

describe('sliderMath', () => {
  it('index from offset is clamped and survives resize', () => {
    expect(indexFromOffset(2 * 1440, 1440, 7)).toBe(2)
    expect(indexFromOffset(2 * 390, 390, 7)).toBe(2)
    expect(indexFromOffset(99999, 1440, 7)).toBe(6)
    expect(indexFromOffset(-50, 1440, 7)).toBe(0)
  })
  it('flick advances one poster', () => {
    expect(snapTarget(1440 * 1.2, 1.2, 1440, 7)).toBe(2)
    expect(snapTarget(1440 * 1.2, -1.2, 1440, 7)).toBe(1)
    expect(snapTarget(1440 * 1.2, 0, 1440, 7)).toBe(1)
  })
  it('bend is clamped and odd', () => {
    expect(Math.abs(bendFromVelocity(100))).toBeLessThanOrEqual(0.35)
    expect(bendFromVelocity(-0.3)).toBeCloseTo(-bendFromVelocity(0.3))
    expect(bendFromVelocity(0)).toBe(0)
  })
  it('overlap endpoints', () => {
    expect(overlapState(0)).toEqual({ outScale: 1, outDim: 1, inX: 1 })
    const end = overlapState(1)
    expect(end.outScale).toBeCloseTo(0.92); expect(end.outDim).toBeCloseTo(0.6); expect(end.inX).toBeCloseTo(0)
  })
  it('trackpad burst advances once', () => {
    const intent = createWheelIntent()
    let moves = 0
    for (let t = 0; t < 400; t += 8) moves += Math.abs(intent(12, 0, t))
    expect(moves).toBe(1)
    expect(intent(80, 0, 1200)).toBe(1)
  })
  it('drag cancels click', () => { expect(isClick(4)).toBe(true); expect(isClick(12)).toBe(false) })
})
```
- [ ] Red → implement → green.

### Task 3: `src/home/sliderController.ts` (DOM, desktop + a11y)

```ts
export interface SliderController { goTo(index: number, opts?: { instant?: boolean }): void; readonly index: number; onChange(cb: (index: number, velocity: number) => void): () => void; destroy(): void }
export function createSliderController(track: HTMLElement, opts: { reducedMotion: boolean; announce: (text: string) => void }): SliderController
```
- Fine pointer: wheel via `createWheelIntent`, pointer drag with inertia → `snapTarget`, arrows/PageUp/PageDown, focusin on a poster → goTo. Animate `track.scrollLeft` with transition easing (gsap if loaded, else rAF with the same cubic-bezier). Write CSS vars on posters from `overlapState` each frame (`--out-scale`, `--out-dim`, `--in-x`). Drag > 6 px suppresses the click (`isClick`).
- Coarse pointer: no custom input; listen to native `scroll` → `indexFromOffset`, emit velocity from scroll deltas.
- `announce('02 of 06: SolidPixels')` on index change (hero = 00). Update header index `NN / 06`.
- Test `sliderController.test.ts`: listener balance with `EventTarget` fakes (destroy removes all), and `isClick` path.
- [ ] Implement + tests green.

### Task 4: Loader + hero reveal

- `src/home/loader.ts`: `createLoader({ steps: ['fonts', 'three', 'firstFrame'], onProgress, onDone })`; `mark(step)`; progress = done/3 → 0..100 monotonic; `onDone` after all or after 2500 ms timeout (never blocks the page). Test progress monotonic + timeout path (fake timers).
- Home: `document.fonts.ready` → `fonts`; runtime import → `three`; first render → `firstFrame`. Loader UI mono counter; on done, hero words rise from mask lines (expo-out, 80 ms stagger); reduced motion: instant.

### Task 5: WebGL posters

**Files:** `src/home/loadPosterRuntime.ts` (+ test, same result shape as `loadWireRuntime`: created/canceled/failed; imports `three` and `gsap` dynamically, progress callback), `src/home/posterRuntime.ts`.
```ts
export interface PosterRuntime { setActive(index: number): void; setVelocity(v: number): void; destroy(): void }
export function createPosterRuntime(three: any, opts: { host: HTMLElement; slots: HTMLElement[]; accents: string[]; reducedMotion: boolean; onFirstFrame(): void }): PosterRuntime
```
- One fixed full-viewport canvas behind the track; each poster's `.poster-visual` slot rect maps to a scene region (scissor per visible slot, max 2 visible during transition).
- Scenes per spec "Poster visuals" (01 court + ball arc, 02 CMS blocks settling, 03 gates pass/block, 04 VITEK wire static — reuse `buildVitekPath()` from `src/playground/wirePath.ts` (pure data; allowed import), 05 two displays + deck outline, 06 none). One directional light direction shared. Accent colours from posters.
- Velocity bend: vertex shader offset along x by `bendFromVelocity(v)·sin(uv.y·π)` applied to each visual's root (or a post-pass on the region); eased back when v → 0; zero with reduced motion.
- Each visual animates once on `setActive` (≤ 1.4 s), then static. Render only while animating or velocity ≠ 0; pause on hidden tab; DPR cap 2, weak tier (30 frames avg > 22 ms) → DPR 1.
- WebGL failure → `data-home-state="static"`, CSS accent compositions remain.
- Tests: loader seam (created / canceled / failed), `destroy()` listener balance.

### Task 6: Transitions + details

- Poster link click (internal): if `document.startViewTransition` exists, set `view-transition-name: poster-visual` on the clicked visual and on the target page hero container (add a stable class on existing route heroes via CSS only if possible; else wrap in App-level `view-transition-name` on `main`), then navigate inside the transition callback. Else 400 ms curtain (`cubic-bezier(0.76,0,0.24,1)`). Reduced motion: plain navigation.
- Magnetic contact CTA (pull 0.3, fine pointer only). Optional cursor dot with `Drag`/`Open` labels on fine pointer.
- 404 copy `This page doesn't exist.` in the same visual system (App.tsx not-found branch).
- Update `styles.test.ts` home blocks: scroll-snap on track, reduced-motion rules, `::selection`, focus ring, grain `pointer-events: none`.

### Task 7: Proof (cmux)

Proof dir from prompt. Screenshots: loader mid-count, hero after reveal, each poster 01–06 at desktop (1440 wide if the cmux window allows; report actual size) and narrow, mid-drag bend frame, transition to `/gameonvb`, reduced-motion (emulate via `matchMedia` override in eval if needed; else report). FPS during slide, console errors (0). Run Lighthouse only if available locally without install; otherwise report skipped.

## Final checks

`npm test`, `npm run check`, `npm run build`, `git diff --check`, `git status --short` within allowed paths.
