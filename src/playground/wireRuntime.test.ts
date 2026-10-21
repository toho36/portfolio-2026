import { expect, it } from 'vitest'
import { OrthographicCamera, Vector3 } from 'three'
import { buildVitekPath, LOOP } from './wirePath'
import { attachWireInput, wireFraming } from './wireRuntime'

it.each([[360, 468, 140, 82], [390, 572, 140, 82], [820, 908, 140, 82], [360, 468, 210, 130]])(
  'fits the overview route, posts and captions clear of the HUD/footer at %ix%i', (width, height, top, bottom) => {
    const framing = wireFraming(width, height, false, { top, bottom })
    expect(framing.overview).toBe(true)
    const camera = new OrthographicCamera(-width / framing.scale / 2, width / framing.scale / 2,
      height / framing.scale / 2, -height / framing.scale / 2, 0.1, 100)
    camera.position.set(9.9, framing.centerY + 3.7, 17)
    camera.lookAt(7.7, framing.centerY, 0)
    camera.updateMatrixWorld()
    const screen = (x: number, y: number, z = 0) => {
      const p = new Vector3(x, y, z).project(camera)
      return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }
    }
    const inside = (x: number, y: number) => {
      expect(x).toBeGreaterThanOrEqual(8)
      expect(x).toBeLessThanOrEqual(width - 8)
      expect(y).toBeGreaterThanOrEqual(top + 8)
      expect(y).toBeLessThanOrEqual(height - bottom - 8)
    }
    const path = buildVitekPath()
    for (const p of [...path.points, ...path.hazards.flat()]) {
      for (const dx of [-LOOP.wireRadius, LOOP.wireRadius]) {
        for (const dy of [-LOOP.wireRadius, LOOP.wireRadius]) {
          const q = screen(p.x + dx, p.y + dy)
          inside(q.x, q.y)
        }
      }
    }
    for (const p of [path.start, path.finish]) {
      for (const dx of [-0.16, 0.16]) {
        for (const dy of [-0.16, 0.16]) {
          for (const z of [0, 0.6]) {
            const q = screen(p.x + dx, p.y + dy, z)
            inside(q.x, q.y)
          }
        }
      }
      const q = screen(p.x, p.y)
      inside(q.x - 35, q.y - 34)
      inside(q.x + 35, q.y - 21)
    }
    for (const x of [1.5, 3.7, 5.5, 8.8, 13]) {
      const q = screen(x, -1)
      inside(q.x, q.y)
      inside(q.x + 14, q.y + 12)
    }
  },
)

it.each([[360, 468], [390, 572], [820, 908]])('keeps the existing follow scale while active at %ix%i', (width, height) => {
  const framing = wireFraming(width, height, true, { top: 140, bottom: 82 })
  expect(framing.follow).toBe(true)
  expect(framing.overview).toBe(false)
  expect(framing.scale).toBe(56 / (LOOP.outerRadius * 2))
  expect(framing.centerY).toBe(2.6)
})

it.each([false, true])('keeps desktop framing unchanged (active: %s)', (active) => {
  const framing = wireFraming(1440, 900, active, { top: 140, bottom: 82 })
  expect(framing.follow).toBe(false)
  expect(framing.overview).toBe(false)
  expect(framing.scale).toBe(Math.min((1440 - 64) / 16.1, (900 - 130) / 7.3))
  expect(framing.centerY).toBe(2.6)
})

it('removes every input listener on detach', () => {
  const target = new EventTarget()
  const seen: string[] = []
  const detach = attachWireInput(target, {
    pointerdown: () => seen.push('down'), pointermove: () => seen.push('move'),
    pointerup: () => seen.push('up'),
  })
  for (const name of ['pointerdown', 'pointermove', 'pointerup']) target.dispatchEvent(new Event(name))
  detach()
  for (const name of ['pointerdown', 'pointermove', 'pointerup']) target.dispatchEvent(new Event(name))
  expect(seen).toEqual(['down', 'move', 'up'])
})
