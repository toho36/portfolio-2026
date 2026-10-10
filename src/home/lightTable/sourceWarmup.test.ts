import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { BALL_DURATION, createBallFlow, createBallChoreography, captureBallOrientation, firstBallPose, advanceBallOrientation, bridgeBallSpin } from './ballFlow.js'
import { createSpin, stepSpin, followPosition, brushSpin } from './ballMotion.js'

// Run the production effect, replacing only dynamic imports and browser/GPU boundaries.
const source = readFileSync(new URL('./Volleyball.jsx', import.meta.url), 'utf8')
const effect = source.slice(source.indexOf('  useEffect(()=>{') + '  useEffect(()=>{'.length, source.indexOf('  },[active,reduced])'))
  .replace("Promise.all([import('three'),import('./ballScene.js')])", 'loadView()')
const run = (context: Record<string, any>) => new Function('context', `with(context){${effect}}`)(context)
const ref = (current: any) => ({ current })
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
afterEach(() => vi.unstubAllGlobals())

function fixture({ ready = false, reduced = false, hidden = false, inert = false, dialog = false, detail = false } = {}) {
  const queue = new Map<number, FrameRequestCallback>(), listeners = new Map<string, (...args: any[]) => void>()
  let id = 0, now = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { queue.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  const deck = { dataset: { position: ready ? '1.000' : '.400', settling: String(!ready) } }, cta = { hidden: !ready }
  const image = { src: 'same-model', style: { cssText: '' }, dataset: {} }
  const surface = { dataset: {}, querySelector: () => image, closest: () => ({}), addEventListener: (k: string, fn: any) => listeners.set(k, fn), removeEventListener: (k: string) => listeners.delete(k) }
  const sheet = { closest: (q: string) => q === '.light-table' ? deck : inert ? {} : null, querySelector: (q: string) => q === '.sheet-cta' ? cta : null,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 600, height: 500 }), addEventListener: (k: string, fn: any) => listeners.set(k, fn), removeEventListener: (k: string) => listeners.delete(k) }
  const doc = { hidden, querySelector: () => dialog ? {} : null, addEventListener: (k: string, fn: any) => listeners.set(k, fn), removeEventListener: (k: string) => listeners.delete(k) }
  const host: any = { ballSurface: surface, ownerDocument: doc, closest: () => sheet, clientHeight: 500,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 600, height: 500 }), dataset: { diameter: '200', motion: JSON.stringify({ position: [0, 0, 0] }) },
    addEventListener: (k: string, fn: any) => listeners.set(k, fn), removeEventListener: (k: string) => listeners.delete(k) }
  const pose = { x: .2, y: .1, time: 8, spin: createSpin() }
  const makeEntry = (cold = false) => ({ want: true, source: { width: 600, height: 500 }, screenWidth: 1440, screenHeight: 1000, pose,
    choreography: createBallChoreography({ support: [.2, -.9, 0], corner: [-2, -1.05, 0] }, pose), orientation: captureBallOrientation(pose), started: cold, resize: vi.fn(), paint: vi.fn(), land: vi.fn() })
  if (detail) host.ballEntry = makeEntry(true)
  const pending: ((modules: any[]) => void)[] = [], observers: any[] = []
  const canvas = { parentElement: null as any }
  const view = { frame: { width: 600, height: 500 }, entryProjection: {}, paint: vi.fn(), paintEntry: vi.fn(), resize: vi.fn(), extend: vi.fn(),
    snapshot: vi.fn(() => 'same-model'), snapshotPose: vi.fn(() => 'scene'), destroy: vi.fn(() => { canvas.parentElement = null }) }
  const factory = vi.fn(() => { canvas.parentElement = surface; return view })
  const context = { ref: ref(host), clockRef: ref({ time: detail ? BALL_DURATION : 0, velocity: 0 }), timeRef: ref(pose.time), spinRef: ref(pose.spin), positionRef: ref({ x: pose.x, y: pose.y }), previewRef: ref('same-model'),
    active: true, reduced, innerWidth: 1440, innerHeight: 1000, createBallFlow, BALL_DURATION, firstBallPose, advanceBallOrientation, bridgeBallSpin, stepSpin, followPosition, brushSpin,
    ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { callback: () => void; connected = false; observe = vi.fn((target: any, options: any) => { expect(target).toBe(deck); expect(options).toEqual({ attributes: true, attributeFilter: ['data-position', 'data-settling'] }); this.connected = true }); disconnect = vi.fn(() => { this.connected = false }); constructor(callback: () => void) { this.callback = callback; observers.push(this) } },
    loadView: vi.fn(() => new Promise(resolve => pending.push(resolve))),
  }
  let cleanup = run(context)
  const mutate = async (position: string, settling: boolean, ctaHidden: boolean) => {
    deck.dataset.position = position; deck.dataset.settling = String(settling); cta.hidden = ctaHidden
    await Promise.resolve() // Native observers see current DOM after the root commit.
    observers.filter(o => o.connected).forEach(o => o.callback())
    await flush()
  }
  const resolve = async () => { pending.shift()?.([{}, { createVolleyball: factory }]); await flush() }
  const tick = () => { now += 16; const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn(now)) }
  return { context, host, view, surface, canvas, image, factory, pending, observers, doc, queue, listeners, mutate, resolve, tick,
    setInert(value: boolean) { inert = value },
    enter(cold = false) { host.ballEntry = makeEntry(cold); listeners.get('ballentrychange')!() },
    rerender(nextReduced: boolean) { cleanup(); context.reduced = nextReduced; cleanup = run(context) },
    cleanup() { cleanup() },
  }
}

it('defers a cold partially active source until its CTA is visible and deck assistance is settled, then creates exactly once at the current pose', async () => {
  const h = fixture()
  try {
    await h.resolve()
    expect(h.factory).not.toHaveBeenCalled()
    h.tick(); expect(h.queue.size).toBe(0)
    for (const [position, settling, hidden] of [['.650', true, true], ['1.000', true, false], ['.800', false, true], ['1.000', true, false]] as const) {
      await h.mutate(position, settling, hidden); await h.resolve()
      expect(h.factory).not.toHaveBeenCalled()
    }
    h.context.positionRef.current = { x: -.1, y: .3 }; h.context.timeRef.current = 9
    const spin = h.context.spinRef.current
    await h.mutate('1.000', false, false)
    expect(h.pending).toHaveLength(1)
    await h.mutate('1.000', false, false)
    expect(h.pending).toHaveLength(1)
    await h.resolve()
    expect(h.factory).toHaveBeenCalledTimes(1)
    expect(h.view.paint).toHaveBeenCalledWith(-.1, .3, 9, spin)
    expect(h.host.ballSurface).toBe(h.surface); expect(h.image.src).toBe('same-model')
    await h.mutate('1.000', false, false); await h.resolve()
    expect(h.factory).toHaveBeenCalledTimes(1)
  } finally { h.cleanup() }
})

it('rechecks readiness after a pending import when a new wheel interrupts assistance and retries only after the stable endpoint', async () => {
  const h = fixture({ ready: true })
  try {
    expect(h.pending).toHaveLength(1)
    await h.mutate('.900', true, true); await h.resolve()
    expect(h.factory).not.toHaveBeenCalled()
    await h.mutate('1.000', true, false); expect(h.pending).toHaveLength(0)
    await h.mutate('1.000', false, false); expect(h.pending).toHaveLength(1)
    await h.resolve(); expect(h.factory).toHaveBeenCalledTimes(1)
  } finally { h.cleanup() }
})

it('does not lose a stable root change delivered while a deferred import finishes', async () => {
  const h = fixture({ ready: true })
  try {
    await h.mutate('.900', true, true)
    h.pending.shift()!([{}, { createVolleyball: h.factory }])
    await Promise.resolve() // The import continuation rejects the still-moving source.
    expect(h.factory).not.toHaveBeenCalled()
    await h.mutate('1.000', false, false) // Observer delivery can precede import finally.
    expect(h.pending).toHaveLength(1)
    await h.resolve(); expect(h.factory).toHaveBeenCalledTimes(1)
  } finally { h.cleanup() }
})

it('retains the live canvas, flow clock and native brush while assistance resumes', async () => {
  const h = fixture({ ready: true })
  try {
    await h.resolve(); h.tick(); h.tick()
    const flow = h.host.ballFlow, state = flow.state, resume = vi.spyOn(flow, 'resume'), spin = h.context.spinRef.current
    await h.mutate('.850', true, true); await h.mutate('1.000', false, false)
    expect(h.host.ballView).toBe(h.view); expect(h.canvas.parentElement).toBe(h.surface)
    expect(h.host.ballFlow).toBe(flow); expect(flow.state).toEqual(state); expect(resume).not.toHaveBeenCalled()
    expect(h.view.destroy).not.toHaveBeenCalled(); expect(h.factory).toHaveBeenCalledTimes(1)
    h.listeners.get('pointermove')!({ pointerType: 'mouse', clientX: 180, clientY: 250, timeStamp: 10 })
    h.listeners.get('pointermove')!({ pointerType: 'mouse', clientX: 420, clientY: 250, timeStamp: 30 })
    expect(h.context.spinRef.current.yawSpeed).toBeGreaterThan(spin.yawSpeed)
    h.tick(); h.tick(); h.tick(); expect(h.view.paint.mock.calls.length).toBeGreaterThan(1)
    expect(h.host.ballView).toBe(h.view)
  } finally { h.cleanup() }
})

it.each([false, true])('detail bypasses the initial source gate with a %s pending source import', async pendingSource => {
  const h = fixture({ ready: pendingSource, detail: !pendingSource })
  try {
    if (pendingSource) { await h.mutate('.500', true, true); h.enter() }
    const entry = h.host.ballEntry, flow = h.host.ballFlow, state = flow.state
    expect(h.pending).toHaveLength(1)
    await h.resolve()
    expect(h.factory).toHaveBeenCalledTimes(1); expect(h.host.ballFlow).toBe(flow); expect(flow.state).toEqual(state)
    expect(h.view.paintEntry).toHaveBeenCalled(); expect(entry.paint).toHaveBeenCalled()
  } finally { h.cleanup() }
})

it('a deferred source can enter detail without waiting for source CTA readiness', async () => {
  const h = fixture()
  try {
    expect(h.pending).toHaveLength(0); h.enter(); expect(h.pending).toHaveLength(1)
    await h.resolve(); expect(h.factory).toHaveBeenCalledTimes(1); expect(h.view.paintEntry).toHaveBeenCalled()
  } finally { h.cleanup() }
})

it.each([{ hidden: true }, { inert: true }, { dialog: true }, { reduced: true }])('never allocates an ineligible initial source: %j', async options => {
  const h = fixture(options)
  try {
    await h.mutate('1.000', false, false); await h.resolve()
    expect(h.factory).not.toHaveBeenCalled(); expect(h.host.ballView).toBeUndefined()
  } finally { h.cleanup() }
})

it.each(['hidden', 'dialog', 'inert', 'cleanup', 'contextlost'] as const)('rejects a pending import after %s', async reason => {
  const h = fixture({ ready: true })
  try {
    expect(h.pending).toHaveLength(1)
    if (reason === 'hidden') h.doc.hidden = true
    if (reason === 'dialog') h.doc.querySelector = () => ({})
    if (reason === 'inert') h.setInert(true)
    if (reason === 'cleanup') h.cleanup()
    if (reason === 'contextlost') h.listeners.get('webglcontextlost')!({ preventDefault: vi.fn() })
    await h.resolve(); expect(h.factory).not.toHaveBeenCalled()
    if (reason === 'contextlost') { await h.mutate('1.000', false, false); expect(h.pending).toHaveLength(0) }
  } finally { h.cleanup() }
})

it('visibility and reduced-motion changes release pending generations and resume only when ready', async () => {
  const h = fixture({ ready: true })
  try {
    h.doc.hidden = true; h.listeners.get('visibilitychange')!(); await h.resolve()
    expect(h.factory).not.toHaveBeenCalled()
    await h.mutate('.500', true, true)
    h.doc.hidden = false; h.listeners.get('visibilitychange')!(); expect(h.pending).toHaveLength(0)
    await h.mutate('1.000', false, false); expect(h.pending).toHaveLength(1)
    h.rerender(true); await h.resolve(); expect(h.factory).not.toHaveBeenCalled()
    await h.mutate('1.000', false, false); expect(h.pending).toHaveLength(0)
    h.rerender(false); await h.resolve(); expect(h.factory).toHaveBeenCalledTimes(1)
  } finally { h.cleanup() }
})

it('reduced detail keeps its logical endpoint and same-model preview without a GPU', async () => {
  const h = fixture({ detail: true, reduced: true })
  try {
    await h.mutate('1.000', false, false); await h.resolve()
    expect(h.factory).not.toHaveBeenCalled(); expect(h.host.ballFlow.state.time).toBe(BALL_DURATION)
    expect(h.host.ballEntry.land).toHaveBeenCalledWith(1); expect(h.image.src).toBe('same-model')
  } finally { h.cleanup() }
})

it('disconnects the source observer on cleanup and rejects even a queued late callback', async () => {
  const h = fixture()
  expect(h.observers).toHaveLength(1)
  const observer = h.observers[0]
  h.cleanup()
  expect(observer.disconnect).toHaveBeenCalledTimes(1)
  await h.mutate('1.000', false, false); observer.callback(); await h.resolve()
  expect(h.factory).not.toHaveBeenCalled(); expect(h.pending).toHaveLength(0)
  expect(h.queue.size).toBe(0); expect(h.host.ballFlow).toBeUndefined()
})
