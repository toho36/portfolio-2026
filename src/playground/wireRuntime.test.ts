import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { OrthographicCamera, Vector3 } from 'three'
import { buildVitekPath, nearestInWindow, pointAt, LOOP } from './wirePath'
import { attachWireInput, createWireRuntime, wireFraming } from './wireRuntime'

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


// Real scene, camera, geometry and game rules; only the GPU and DOM are replaced.
function gameHarness() {
  class Element extends EventTarget {
    attributes = new Map<string, string>(); style = { cssText: '' }; className = ''; textContent = ''
    classList = { add() {}, remove() {} }; offsetWidth = 40; offsetHeight = 14
    clientWidth = 1440; clientHeight = 900; parentElement = { querySelector: () => null }
    setAttribute(name: string, value: string) { this.attributes.set(name, value) }
    appendChild() {}; remove() {}; setPointerCapture() {}; focus() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 1440, height: 900, bottom: 900 } }
  }
  const canvas = new Element(), host = new Element(), doc = Object.assign(new EventTarget(), { hidden: false, createElement: () => new Element() })
  const frames = new Map<number, FrameRequestCallback>(); let id = 0, time = 0
  vi.spyOn(performance, 'now').mockImplementation(() => time)
  vi.stubGlobal('window', { devicePixelRatio: 1 })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (n: number) => frames.delete(n))
  vi.stubGlobal('ResizeObserver', class { observe() {}; disconnect() {} })
  const audio = vi.fn(function () { return { resume() {}, close() {} } }); vi.stubGlobal('AudioContext', audio)
  const hud = { onProgress: vi.fn(), onHold: vi.fn(), onFail: vi.fn(), onFinish: vi.fn() }
  const renderer = { domElement: canvas, shadowMap: { enabled: false, type: 0 }, setPixelRatio() {}, setSize() {}, dispose() {}, forceContextLoss() {},
    render(_scene: unknown, camera: { updateMatrixWorld(): void }) { camera.updateMatrixWorld() } }
  const runtime = createWireRuntime({ ...THREE, WebGLRenderer: class { constructor() { return renderer } } }, {
    host: host as unknown as HTMLElement, reducedMotion: false, hud, onFirstFrame() {},
  })
  runtime.setSound(false)
  const debug = (window as unknown as { __wireDebug: { pose: { x: number; y: number }; grip: { x: number; y: number }; worldToScreen(p: { x: number; y: number }): { x: number; y: number } } }).__wireDebug
  const emit = (name: string, fields: object = {}) => {
    const e = Object.assign(new Event(name, { cancelable: true }), fields); canvas.dispatchEvent(e); return e
  }
  const tick = (ms = 16) => { time += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)) }
  tick()
  return { runtime, hud, debug, canvas, doc, audio, emit, tick, frames, get time() { return time },
    key: (key: string, repeat = false) => emit('keydown', { key, repeat }),
    up: (key: string) => emit('keyup', { key }),
    pointer: (name: string, point = debug.grip) => emit(name, { pointerId: 1, clientX: point.x, clientY: point.y }),
  }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('leaves modified browser shortcuts native while the game is focused', () => {
  const h = gameHarness()
  try {
    h.key('Enter'); h.key('ArrowDown'); h.tick(); h.up('ArrowDown')
    const pose = h.debug.pose
    for (const modifier of ['metaKey', 'ctrlKey', 'altKey']) {
      const event = h.emit('keydown', { key: 'r', [modifier]: true })
      expect(event.defaultPrevented).toBe(false)
      expect(h.debug.pose).toEqual(pose)
    }
  } finally { h.runtime.destroy() }
})

it('starts, pauses and resumes keyboard play without repeat toggles, stale arrows or trapped Tab', () => {
  const h = gameHarness()
  try {
    expect(h.canvas.attributes.get('tabindex')).toBe('0')
    expect(h.canvas.attributes.get('aria-describedby')).toBe('wire-instructions')
    const start = h.debug.pose
    const outside = Object.assign(new Event('keydown', { cancelable: true }), { key: 'ArrowDown' })
    h.doc.dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(false)
    expect(h.key('ArrowDown').defaultPrevented).toBe(true)
    h.tick(); expect(h.debug.pose).toEqual(start)
    h.key('Enter'); h.key('Enter', true)
    expect(h.hud.onHold).toHaveBeenLastCalledWith(true)
    h.key('ArrowDown'); h.tick(); h.up('ArrowDown')
    expect(h.debug.pose.y).toBeLessThan(start.y)
    const moved = h.debug.pose
    h.tick(); expect(h.debug.pose).toEqual(moved)
    h.key(' '); expect(h.hud.onHold).toHaveBeenLastCalledWith(false)
    h.key(' ', true); h.tick(); expect(h.debug.pose).toEqual(moved)
    h.key(' '); expect(h.hud.onHold).toHaveBeenLastCalledWith(true)
    expect(h.key('Tab').defaultPrevented).toBe(false)
    h.emit('blur'); h.tick(); expect(h.debug.pose).toEqual(moved)
    h.key('Enter'); h.tick(); expect(h.debug.pose).toEqual(moved)
    expect(h.audio).not.toHaveBeenCalled()
  } finally { h.runtime.destroy() }
  expect(h.frames.size).toBe(0)
})

it('routes keyboard movement through actual collision and progress rules and clears held input after failure/reset', () => {
  const h = gameHarness()
  try {
    const start = h.debug.pose
    h.key('Enter'); h.key('ArrowDown')
    for (let i = 0; i < 10; i++) h.tick(50)
    expect(h.hud.onProgress.mock.calls.some(([p]) => p > 0)).toBe(true)
    for (let i = 0; i < 30; i++) h.tick(50)
    expect(h.hud.onFail).toHaveBeenCalled()
    expect(h.hud.onFinish).not.toHaveBeenCalled()
    h.key('r'); expect(h.debug.pose).toEqual(start)
    h.key('Enter'); h.tick(50); expect(h.debug.pose).toEqual(start)
    h.key('ArrowDown'); h.emit('blur'); h.key('Enter'); h.tick(50)
    expect(h.debug.pose).toEqual(start)
  } finally { h.runtime.destroy() }
})

it('never shares active input ownership and keeps hard release/reset rules', () => {
  const h = gameHarness()
  try {
    h.key('Enter'); h.pointer('pointerdown')
    h.key(' ')
    h.pointer('pointermove', { x: 1200, y: 700 })
    expect(h.hud.onFail).not.toHaveBeenCalled()
    h.key('r'); h.tick()
    h.pointer('pointerdown')
    expect(h.hud.onHold).toHaveBeenLastCalledWith(true)
    const start = h.debug.pose
    h.key('Enter'); h.key('ArrowDown'); h.tick()
    expect(h.debug.pose).toEqual(start)
    h.pointer('pointerup'); expect(h.hud.onHold).toHaveBeenLastCalledWith(false)
    h.runtime.setMode('hard'); h.key('Enter'); h.key(' ')
    expect(h.hud.onFail).toHaveBeenCalledOnce()
    h.key('r'); h.key('Enter'); h.key('ArrowDown'); h.runtime.restart(); h.tick()
    expect(h.debug.pose).toEqual(start)
    h.key('Enter'); h.tick(); expect(h.debug.pose).toEqual(start)
    expect(h.audio).not.toHaveBeenCalled()
  } finally { h.runtime.destroy() }
})


it('can clear the real path with keyboard steering and excludes only pauses after the timer starts', () => {
  const h = gameHarness(), path = buildVitekPath()
  const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
  let previous = new Set<string>(), distance = 0
  try {
    h.key('Enter'); h.key(' '); h.tick(5000); h.key('Enter')
    const firstMoveAt = h.time + 16
    // The test steers using real key events; production never follows the path for the player.
    for (let frame = 0; frame < 14000 && !h.hud.onFinish.mock.calls.length && !h.hud.onFail.mock.calls.length; frame++) {
      const pose = h.debug.pose
      distance = nearestInWindow(path, pose, distance, .9).s
      const target = h.debug.worldToScreen(pointAt(path, distance + .05).p), screen = h.debug.worldToScreen(pose)
      const angle = Math.round(Math.atan2(target.y - screen.y, target.x - screen.x) / (Math.PI / 4))
      const dx = Math.round(Math.cos(angle * Math.PI / 4)), dy = Math.round(Math.sin(angle * Math.PI / 4))
      const next = new Set<string>()
      if (dx) next.add(dx > 0 ? directions[0] : directions[2])
      if (dy) next.add(dy > 0 ? directions[1] : directions[3])
      for (const key of previous) if (!next.has(key)) h.up(key)
      for (const key of next) if (!previous.has(key)) h.key(key)
      previous = next; h.tick(16)
      if (frame === 1000) { h.key(' '); h.tick(3000); h.key('Enter'); previous = new Set() }
    }
    expect(h.hud.onFail).not.toHaveBeenCalled()
    expect(h.hud.onFinish).toHaveBeenCalledOnce()
    expect(h.hud.onFinish.mock.calls[0][0]).toBe(h.time - firstMoveAt - 3000)
    expect(h.hud.onFinish.mock.calls[0][0]).toBeGreaterThan(60_000)
    expect(h.hud.onProgress).toHaveBeenLastCalledWith(100)
    expect(h.audio).not.toHaveBeenCalled()
  } finally { h.runtime.destroy() }
})
