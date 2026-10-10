import { readFileSync } from 'node:fs'
import * as Three from 'three'
import { expect, it, vi } from 'vitest'
import { BALL_DURATION, advanceBallOrientation, ballFlight, captureBallOrientation, createBallChoreography } from './ballFlow.js'
import { ballContactLayout, ballContactShift, ballEntryPresentation, createVolleyball } from './ballScene.js'
import { staticLanding } from './ballSteps.js'

const native = JSON.parse(readFileSync(new URL('../../../sketches/013-light-table/nativeGeometryReturn.fixture.json', import.meta.url), 'utf8'))
const resized = JSON.parse(readFileSync(new URL('../../../sketches/013-light-table/orientationResizeGeometry.fixture.json', import.meta.url), 'utf8'))
const captures = [...Object.values(native.sources), resized] as { source: import('./ballScene.js').BallSource; card: import('./ballFlow.js').BallCard; pose: import('./ballFlow.js').BallPose; first?: { x: number; y: number; diameter: number } }[]

it('keeps the dark table/source backing and orange only on the GameOnVB card', () => {
  const css = readFileSync(new URL('./lightTable.css', import.meta.url), 'utf8')
  expect(css).not.toMatch(/\.ball-entry-wash::after\s*\{/)
  expect(css).toContain('background: radial-gradient(ellipse at 15% 5%,#3b3323 0,#171916 48%,#0a0e10 100%); mask-image:')
  expect(css).toContain('background: radial-gradient(ellipse at 5% 4%, #44443d55, transparent 55%), #171816;')
  expect(css).toContain("[data-sheet='gameonvb'] .sheet { --paper: #bb461a; --ink: #fff2da; background: #bb461a;")
})

it('carries moderate physical corner momentum through freefall without quaternion resets', () => {
  for (const { card, pose } of captures) {
    const c = createBallChoreography(card, pose), entry = { choreography: c, orientation: captureBallOrientation(pose) }
    expect(c.exitSpeed / c.rollSpeed).toBeCloseTo(.35, 12)
    for (const join of [.30, 1.70, 1.85]) {
      const h = 1e-6, before = ballFlight(join - h, c), at = ballFlight(join, c), after = ballFlight(join + h, c)
      at.velocity.forEach((v, i) => {
        expect((at.position[i] - before.position[i]) / h).toBeCloseTo(v, 3)
        expect((after.position[i] - at.position[i]) / h).toBeCloseTo(v, 3)
      })
    }
    for (let i = 1; i <= 1850; i++) advanceBallOrientation(entry, i / 1000, .001, 1)
    const exit = new Three.Quaternion().fromArray(entry.orientation.quaternion)
    for (let i = 1851; i <= 3100; i++) {
      advanceBallOrientation(entry, i / 1000, .001, 1)
      entry.orientation.angularVelocity.forEach((v, axis) => expect(v).toBeCloseTo(c.axis[axis] * c.exitSpeed / c.radius, 10))
      expect(Math.hypot(...entry.orientation.quaternion)).toBeCloseTo(1, 10)
    }
    expect(exit.angleTo(new Three.Quaternion().fromArray(entry.orientation.quaternion))).toBeCloseTo(c.exitSpeed / c.radius * 1.25, 8)
    const endpoint = ballFlight(3.10 - 1e-8, c)
    endpoint.position.forEach((v, i) => expect(v).toBeCloseTo([-3.45, 2.62, 0][i], 6))
  }
})

it('bounces once by .54 world units on the existing upper tread and rests exactly at 3.55', () => {
  for (const { card, pose } of captures) {
    const c = createBallChoreography(card, pose)
    expect(ballFlight(3.10, c).velocity).toEqual([0, 4.8, 0])
    expect(ballFlight(3.325, c).position[1] - 2.62).toBeCloseTo(.54, 12)
    let crests = 0, previousVelocity = 4.8
    for (let i = 1; i < 450; i++) {
      const age = 3.10 + i / 1000, f = ballFlight(age, c), h = 1e-6
      expect(f.radius).toBe(.92)
      expect(f.position[0]).toBe(-3.45)
      expect(f.position[2]).toBe(0)
      expect(f.position[1] - f.radius).toBeGreaterThanOrEqual(1.7)
      expect(f.position[1]).toBeLessThanOrEqual(3.16 + 1e-12)
      expect((ballFlight(age + h, c).position[1] - ballFlight(age - h, c).position[1]) / (2 * h)).toBeCloseTo(f.vy, 6)
      if (previousVelocity > 0 && f.vy <= 0) crests++
      previousVelocity = f.vy
    }
    expect(crests).toBe(1)
    for (const age of [BALL_DURATION, 4, 10, 100]) expect(ballFlight(age, c)).toMatchObject({ phase: 'rest', position: [-3.45, 2.62, 0], velocity: [0, 0, 0], radius: .92, rebound: false })
  }
})

const viewports = [[1440, 1000], [390, 844], [320, 780], [1000, 900], [844, 390], [768, 1024]]

it('frames flight monotonically between captured exit and preserved landing metrics across source resizes', () => {
  for (const capture of captures) {
    const source = structuredClone(capture.source)
    source.contact = createBallChoreography(capture.card, capture.pose)
    for (const [w, h] of viewports) {
      const start = ballEntryPresentation(source, w, h, 1.85), end = ballEntryPresentation(source, w, h, 3.10)
      const direction = Math.sign(end.diameter - start.diameter)
      const startUnit = start.diameter / (2 * source.contact.radius), endUnit = h / Math.max(8.2, 9.4 / (w / h))
      let previous = start.diameter, previousUnit = startUnit, radius = source.contact.radius
      for (let i = 1; i <= 1250; i++) {
        const age = 1.85 + i / 1000, f = ballEntryPresentation(source, w, h, age), physical = ballFlight(age, source.contact)
        const unit = f.diameter / (2 * physical.radius)
        // Resizing can put the exit below the preserved final diameter. Both
        // endpoint orders must remain monotone, without a tiny valley/regrowth.
        expect((f.diameter - previous) * direction).toBeGreaterThanOrEqual(-1e-8)
        expect((unit - previousUnit) * Math.sign(endUnit - startUnit)).toBeGreaterThanOrEqual(-1e-8)
        expect(physical.radius).toBeLessThanOrEqual(radius)
        expect(f.diameter).toBeGreaterThanOrEqual(Math.min(start.diameter, end.diameter) - 1e-8)
        expect(f.diameter).toBeLessThanOrEqual(Math.max(start.diameter, end.diameter) + 1e-8)
        previous = f.diameter; previousUnit = unit; radius = physical.radius
      }
      expect(end.span).toBe(Math.max(8.2, 9.4 / (w / h)))
      expect(end.orientationP).toBe(1)
      expect(end.diameter / h).toBeCloseTo(staticLanding(w / h, w).ball.diameter, 12)
    }
  }
})

it('clears every intermediate Three camera orientation before turning the captured fan', () => {
  const endCamera = new Three.OrthographicCamera()
  endCamera.position.set(7, 8, 15); endCamera.lookAt(0, .6, 0)
  for (const capture of captures) {
    const source = structuredClone(capture.source)
    source.contact = createBallChoreography(capture.card, capture.pose)
    for (const [w, h] of viewports) {
      const exit = ballEntryPresentation(source, w, h, 2.5).fan.exitTime
      expect(exit).toBeLessThanOrEqual(2.80)
      const f = ballEntryPresentation(source, w, h, exit + 1e-5), basis = source.fanBasis!, layout = ballContactLayout(source, w, h)
      const { left, right: edge, top, bottom } = basis.bounds
      for (let i = 0; i <= 1000; i++) {
        const p = i / 1000, q = new Three.Quaternion().slerp(endCamera.quaternion, p)
        const right = new Three.Vector3(1, 0, 0).applyQuaternion(q), up = new Three.Vector3(0, 1, 0).applyQuaternion(q)
        const aspect = source.aspect! + (source.width / source.height - source.aspect!) * p
        const B = source.origin.b * layout.scale * (1 - p), D = source.origin.d * layout.scale * (1 - p) + h / source.height * p
        const projectedBottom = Math.max(...[[left, top], [edge, top], [left, bottom], [edge, bottom]].map(([x, y]) => {
          const v = new Three.Vector3(...basis.x).multiplyScalar(x).addScaledVector(new Three.Vector3(...basis.y), y)
          return B * source.width / (f.span * aspect) * right.dot(v) - D * source.height / f.span * up.dot(v) + f.fan.y
        }))
        expect(projectedBottom).toBeLessThanOrEqual(0)
      }
      for (const age of [exit - 1e-6, exit, exit + 1e-6]) expect(ballEntryPresentation(source, w, h, age).orientationP).toBeLessThan(1e-8)
      for (const join of [.30, 1.70, 1.85]) {
        const step = 1e-6, a = ballEntryPresentation(source, w, h, join - step), b = ballEntryPresentation(source, w, h, join), c = ballEntryPresentation(source, w, h, join + step)
        for (const axis of ['x', 'y'] as const) expect(Math.abs((b[axis] - a[axis]) / step - (c[axis] - b[axis]) / step)).toBeLessThan(.1)
      }
      const initialShift = ballContactShift(source, w, h, 0)
      expect(Math.hypot(initialShift.x, initialShift.y)).toBe(0)
      expect(source.contact.card.affine).toEqual(capture.card.affine)
    }
  }
})

it('uses actual Three projection for the ball and frozen whole fan with strict corners, bounds and identity', () => {
  let renderer!: Renderer, count = 0
  class Renderer {
    info = { render: { triangles: 1 } }
    shadowMap = {}
    pixelRatio = 1
    scene: any
    camera: any
    domElement = { width: 0, height: 0, style: { cssText: '' }, setAttribute() {}, remove() {} }
    constructor() { renderer = this; count++ }
    setClearColor() {}
    getClearAlpha() { return 0 }
    setPixelRatio(r: number) { this.pixelRatio = r }
    setDrawingBufferSize(w: number, h: number, r: number) { this.pixelRatio = r; this.domElement.width = Math.floor(w * r); this.domElement.height = Math.floor(h * r) }
    render(scene: any, camera: any) { this.scene = scene; this.camera = camera; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
    dispose() {}
    forceContextLoss() {}
  }
  const ctx = { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, ellipse() {}, fill() {}, drawImage() {}, createRadialGradient: () => ({ addColorStop() {} }) }
  const host = { clientWidth: 600, clientHeight: 500, dataset: {} as Record<string, string>, ownerDocument: { createElement: () => ({ getContext: () => ctx }) }, append() {} }
  vi.stubGlobal('devicePixelRatio', 3)
  const view = createVolleyball({ ...Three, WebGLRenderer: Renderer }, host as unknown as HTMLElement)
  try {
    const canvas = renderer.domElement, scene = renderer.scene, ball = scene.children[0], materials = ball.children.map((child: any) => child.material)
    for (const capture of captures) {
      const { pose } = capture, source = structuredClone(capture.source)
      source.contact = createBallChoreography(capture.card, pose)
      const entry = { choreography: source.contact, orientation: captureBallOrientation(pose) }
      view.resize(source.width, source.height); view.paint(pose.x, pose.y, pose.time, pose.spin)
      view.extend(source.viewport!.width, source.viewport!.height, source)
      const first = JSON.parse(host.dataset.projection)
      if (capture.first) for (const key of ['x', 'y', 'diameter'] as const) expect(first[key]).toBeCloseTo(capture.first[key], 8)
      const basis = source.fanBasis!, frozen = structuredClone(basis)
      for (const [w, h] of [...viewports, [4000, 3000]]) {
        view.resizeEntry(w, h)
        expect(renderer.pixelRatio).toBeLessThanOrEqual(1.5)
        expect(canvas.width * canvas.height).toBeLessThanOrEqual(4_000_000)
        if (w === 1440) expect(renderer.pixelRatio).toBe(1.5)
        for (let i = 0; i <= 710; i++) {
          const age = i / 200
          view.paintEntry(age, pose.x, pose.y, pose.time, pose.spin, entry)
          const f = ballEntryPresentation(source, w, h, age, pose), projected = JSON.parse(host.dataset.projection)
          for (const key of ['x', 'y', 'diameter'] as const) expect(projected[key]).toBeCloseTo(f[key], 8)
          // Measure a physical diameter through the real camera, independently
          // of the dataset's diameter formula. Source clip is a similarity.
          const up = new Three.Vector3(0, 1, 0).applyQuaternion(renderer.camera.quaternion)
          const top = view.projectEntry(ball.position.clone().addScaledVector(up, ball.scale.x).toArray())
          const bottom = view.projectEntry(ball.position.clone().addScaledVector(up, -ball.scale.x).toArray())
          expect(Math.hypot(top.x - bottom.x, top.y - bottom.y)).toBeCloseTo(f.diameter, 8)
          if (age >= .62 && age <= 1.70) {
            const physical = ballFlight(age, source.contact), support = view.projectEntry(physical.support!)
            expect(Math.hypot(...physical.position.map((v, axis) => v - physical.support![axis]))).toBeCloseTo(physical.radius, 12)
            const vertical = Math.max(2.6, 2.6 / source.aspect!), local = physical.support!.map((v, axis) => v - source.contact.anchor[axis])
            const px = source.width / 2 + local[0] * source.width / (vertical * source.aspect!), py = source.height / 2 - local[1] * source.height / vertical
            const sx = source.origin.x + source.origin.a * px + source.origin.c * py, sy = source.origin.y + source.origin.b * px + source.origin.d * py
            expect(Math.hypot(support.x - (f.fan.a * sx + f.fan.c * sy + f.fan.x), support.y - (f.fan.b * sx + f.fan.d * sy + f.fan.y))).toBeLessThan(.02)
          }
          if (w !== 4000) {
            expect(f.x - f.diameter / 2).toBeGreaterThanOrEqual(-.02)
            expect(f.x + f.diameter / 2).toBeLessThanOrEqual(w + .02)
            expect(f.y - f.diameter / 2).toBeGreaterThanOrEqual(-.02)
            expect(f.y + f.diameter / 2).toBeLessThanOrEqual(h + .02)
          }
          const live = view.entryProjection.fanFrame!, { left, right, top: fanTop, bottom: fanBottom } = basis.bounds
          for (const [x, y] of [[left, fanTop], [right, fanTop], [left, fanBottom], [right, fanBottom]]) {
            expect(Math.hypot(live.a * x + live.c * y + live.x - (f.fan.a * x + f.fan.c * y + f.fan.x), live.b * x + live.d * y + live.y - (f.fan.b * x + f.fan.d * y + f.fan.y))).toBeLessThan(.02)
          }
          if (age <= f.fan.exitTime) expect(f.orientationP).toBe(0)
          if (f.orientationP > 0) { expect(f.fan.bottom).toBeLessThanOrEqual(.02); expect(live.bottom).toBeLessThanOrEqual(.02) }
          if (age === 2.15) expect(f.orientationP).toBe(0)
          expect(source.fanBasis).toBe(basis)
          expect(JSON.parse(host.dataset.quaternion)).toEqual(entry.orientation.quaternion)
        }
        expect(basis).toEqual(frozen)
        expect(ball.children.map((child: any) => child.material)).toEqual(materials)
        expect(renderer.scene).toBe(scene)
        expect(renderer.domElement).toBe(canvas)
      }
    }
    expect(count).toBe(1)
  } finally { view.destroy(); vi.unstubAllGlobals() }
}, 30_000)
