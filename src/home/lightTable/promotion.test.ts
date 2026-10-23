import { readFileSync } from 'node:fs'
import * as Three from 'three'
import { expect, it, vi } from 'vitest'
import {
  BALL_DURATION, advanceBallOrientation, ballFlight, ballPoseQuaternion,
  bridgeBallSpin, captureBallOrientation, createBallChoreography, stepBallFlow,
} from './ballFlow.js'
import { ballEntryPresentation, createVolleyball } from './ballScene.js'
import { staticLanding } from './ballSteps.js'
import { deckPosition, sheetPose } from './model.js'
import { createDeckAssist } from './deckAssist.js'
import { revealStep } from './watchModel.js'

const pose = { x: .23, y: -.17, time: 9, spin: { yaw: 3, pitch: 1, yawSpeed: 2, pitchSpeed: .7 } }
const card = { support: [.2, -.9, 0], corner: [-2, -1.05, 0] }
// The repo's node:fs declaration exposes only UTF-8 reads.
const readBytes = readFileSync as unknown as (path: URL) => Uint8Array

it('retains contact, accelerating roll, corner velocity joins and one upper-tread bounce', () => {
  const c = createBallChoreography(card, pose)
  expect(ballFlight(.2, c).radius).toBeGreaterThan(ballFlight(0, c).radius)
  let speed = 0
  for (let t = .62; t < 1.7; t += .01) {
    const f = ballFlight(t, c)
    expect(f.phase).toBe('rolling')
    expect(f.radius).toBe(1.18)
    f.position.forEach((v, i) => expect(v).toBeCloseTo(f.support![i] + c.normal[i] * f.radius, 10))
    expect(f.speed).toBeGreaterThan(speed)
    expect(f.rollingAngle).toBeCloseTo(f.distance / f.radius, 10)
    speed = f.speed
  }
  const arc = ballFlight(1.8, c)
  expect(arc.phase).toBe('corner')
  expect(Math.hypot(...arc.position.map((v, i) => v - c.corner[i]))).toBeCloseTo(c.radius, 10)
  const h = 1e-5
  for (const t of [1.7, 1.85]) {
    const before = ballFlight(t - h, c), at = ballFlight(t, c), after = ballFlight(t + h, c)
    at.velocity.forEach((v, i) => expect((after.position[i] - before.position[i]) / (2 * h)).toBeCloseTo(v, 2))
  }
  expect(ballFlight(1.85, c).support).toBeNull()
  expect(ballFlight(3.1, c).position).toEqual([-3.45, 2.62, 0])
  expect(ballFlight(3.25, c).rebound).toBe(true)
  expect(ballFlight(BALL_DURATION, c)).toMatchObject({ phase: 'rest', position: [-3.45, 2.62, 0], velocity: [0, 0, 0], radius: .92 })
  expect(ballFlight(10, c)).toEqual(ballFlight(BALL_DURATION, c))
})

it('preserves current flow and all quaternion axes through reversal and source return', () => {
  const entry = { choreography: createBallChoreography(card, pose), orientation: captureBallOrientation(pose) }
  const initial = [...entry.orientation.quaternion]
  let state = { time: 0, velocity: 0 }
  for (let i = 0; i < 500; i++) {
    state = stepBallFlow(state, 1, .01)
    advanceBallOrientation(entry, state.time, .01, state.velocity)
  }
  expect(state).toEqual({ time: BALL_DURATION, velocity: 0 })
  expect(entry.orientation.quaternion).not.toEqual(initial)
  expect(stepBallFlow({ time: 2, velocity: 1 }, 0, .005).time).toBeGreaterThan(2)
  const frozen = structuredClone(entry.orientation)
  advanceBallOrientation(entry, 1, 0, -3)
  expect(entry.orientation).toEqual(frozen)
  for (let i = 0; i < 200; i++) {
    state = stepBallFlow(state, 0, .01)
    advanceBallOrientation(entry, state.time, .01, state.velocity)
  }
  expect(state).toEqual({ time: 0, velocity: 0 })
  expect(Math.hypot(...entry.orientation.quaternion)).toBeCloseTo(1, 10)
  const returned = { ...pose, spin: bridgeBallSpin(pose, entry.orientation) }
  ballPoseQuaternion(returned).forEach((v, i) => expect(v).toBeCloseTo(entry.orientation.quaternion[i], 10))
  captureBallOrientation(returned).angularVelocity.forEach((v, i) => expect(v).toBeCloseTo(entry.orientation.angularVelocity[i], 3))
})

it('keeps one scene and logical orientation on resize with DPR1.5 and 4MP caps', () => {
  // Real Three geometry/camera math; only the GPU and canvas drawing are replaced.
  let renderer!: Renderer, count = 0
  class Renderer {
    info = { render: { triangles: 1 } }
    shadowMap = {}
    pixelRatio = 1
    scene: unknown
    domElement = { width: 0, height: 0, style: { cssText: '' }, setAttribute() {}, remove() {} }
    constructor() { renderer = this; count++ }
    setClearColor() {}
    getClearAlpha() { return 0 }
    setPixelRatio(r: number) { this.pixelRatio = r }
    setDrawingBufferSize(w: number, h: number, r: number) {
      this.pixelRatio = r
      this.domElement.width = Math.floor(w * r)
      this.domElement.height = Math.floor(h * r)
    }
    render(scene: { updateMatrixWorld(force: boolean): void }, camera: { updateMatrixWorld(force: boolean): void }) {
      this.scene = scene; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    }
    dispose() {}
    forceContextLoss() {}
  }
  const ctx = { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, drawImage() {}, createRadialGradient: () => ({ addColorStop() {} }) }
  const host = { clientWidth: 600, clientHeight: 500, dataset: {} as Record<string, string>, ownerDocument: { createElement: () => ({ getContext: () => ctx }) }, append() {} }
  vi.stubGlobal('devicePixelRatio', 3)
  const view = createVolleyball({ ...Three, WebGLRenderer: Renderer }, host as unknown as HTMLElement)
  try {
    const source = { width: 600, height: 500, origin: { a: 1, b: 0, c: 0, d: 1, x: 200, y: 200 }, viewport: { width: 1440, height: 1000 }, fanBottom: 820, contact: createBallChoreography(card, pose) }
    const entry = { choreography: source.contact, orientation: captureBallOrientation(pose) }
    view.paint(pose.x, pose.y, pose.time, pose.spin)
    const canvas = renderer.domElement, scene = renderer.scene
    view.extend(1440, 1000, source)
    advanceBallOrientation(entry, .9, .01, 1)
    view.paintEntry(.9, pose.x, pose.y, pose.time, pose.spin, entry)
    expect(JSON.parse(host.dataset.quaternion)).toEqual(entry.orientation.quaternion)
    for (const [w, h] of [[1440, 1000], [390, 844], [4000, 3000]]) {
      view.resizeEntry(w, h)
      expect(renderer.pixelRatio).toBeLessThanOrEqual(1.5)
      expect(canvas.width * canvas.height).toBeLessThanOrEqual(4_000_000)
      if (w === 1440) expect(renderer.pixelRatio).toBe(1.5)
      expect(renderer.scene).toBe(scene)
      expect(renderer.domElement).toBe(canvas)
      expect(JSON.parse(host.dataset.quaternion)).toEqual(entry.orientation.quaternion)
      const projected = JSON.parse(host.dataset.projection)
      const shared = ballEntryPresentation(source, w, h, .9, pose)
      for (const key of ['x', 'y', 'diameter'] as const) expect(projected[key]).toBeCloseTo(shared[key], 8)
    }
    expect(count).toBe(1)
    expect(host.dataset.panels).toBe('18')
    for (const [w, h] of [[1440, 1000], [390, 844]]) {
      view.resizeEntry(w, h); view.paintEntry(BALL_DURATION, pose.x, pose.y, pose.time, pose.spin, entry)
      const projected = JSON.parse(host.dataset.projection), fallback = staticLanding(w / h, w)
      expect(projected.x / w).toBeCloseTo(fallback.ball.x, 10)
      expect(projected.y / h).toBeCloseTo(fallback.ball.y, 10)
      expect(projected.diameter / h).toBeCloseTo(fallback.ball.diameter, 10)
    }
  } finally { view.destroy(); vi.unstubAllGlobals() }
})

it('preserves source-fan/watch preview primitives and exact approved module/asset bytes', () => {
  expect(deckPosition(850, 850)).toBe(1)
  expect(sheetPose(1, 1)).toEqual({ x: 0, y: 0, rotation: -5, scale: 1, opacity: 1, z: 2 })
  expect(revealStep(.5, 0, .016)).toBeLessThan(.5)
  const study = new URL('../../../sketches/013-light-table/', import.meta.url)
  for (const name of ['ballFlow', 'ballMotion', 'ballScene', 'ballSteps', 'ballGeometry', 'leatherMaps', 'model', 'deckAssist']) {
    const original = readFileSync(new URL(`${name}.js`, study), 'utf8')
    const promoted = readFileSync(new URL(`./${name}.js`, import.meta.url), 'utf8')
    // Owner-approved motion/framing refinements and the production scroll repair
    // have executable contracts; every unchanged module stays byte-exact.
    if (name !== 'ballFlow' && name !== 'ballScene' && name !== 'deckAssist') expect(promoted).toBe(original)
    expect(promoted).not.toMatch(/(?:from\s*|import\s*\()['"](?:three|.*sketches)/)
  }
  // The watch scene and its preview were replaced by the owner-approved cloche (clocheScene.js, cloche-preview.png).
  for (const name of ['ball-preview.png']) {
    expect(readBytes(new URL(`./assets/${name}`, import.meta.url))).toEqual(readBytes(new URL(`public/${name}`, study)))
  }
})

it('production deck assistance settles a native edge crossing once and releases all ownership', () => {
  const listeners = new Map<string, (event: { deltaY: number }) => void>(), frames = new Map<number, FrameRequestCallback>()
  let now = 0, id = 0
  const root = { dataset: {} as Record<string, string> }
  const add = (name: string, fn: (event: { deltaY: number }) => void) => listeners.set(name, fn)
  const remove = (name: string) => listeners.delete(name)
  vi.stubGlobal('scrollY', 0); vi.stubGlobal('innerHeight', 1000)
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('document', { hidden: false, querySelector: () => null, addEventListener: add, removeEventListener: remove })
  vi.stubGlobal('addEventListener', add); vi.stubGlobal('removeEventListener', remove)
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('window', { scrollTo: ({ top }: { top: number }) => { globalThis.scrollY = top } })
  const assist = createDeckAssist(root as unknown as HTMLElement, () => false)
  const tick = () => { now += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)) }
  try {
    for (const y of [350, 803, 1180, 1530]) {
      listeners.get('wheel')!({ deltaY: 350 }); globalThis.scrollY = y
      listeners.get('scroll')!({ deltaY: 0 }); tick()
      expect(scrollY).toBe(y)
    }
    for (let i = 0; i < 320; i++) { tick(); listeners.get('scroll')!({ deltaY: 0 }) }
    expect(scrollY).toBe(1700); expect(root.dataset.settling).toBe('false')
    expect(frames.size).toBe(1) // Only the existing input paint-time sampler remains.
    assist.destroy(); expect(frames.size).toBe(0); expect(listeners.size).toBe(0)
  } finally { assist.destroy(); vi.unstubAllGlobals() }
})
