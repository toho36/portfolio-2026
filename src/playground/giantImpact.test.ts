import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { mountGiantImpact } from './GiantImpact'
import type { GiantImpactOptions } from './giantImpact/main.js'

const options = () => ({ onFailure: vi.fn() }) as unknown as GiantImpactOptions
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

describe('Giant Impact import ownership', () => {
  it('a canceled StrictMode mount never constructs a renderer; its live replacement disposes once', async () => {
    const pending: ((module: { createGiantImpact: typeof create }) => void)[] = []
    const dispose = vi.fn(), create = vi.fn(() => ({ dispose }))
    const load = () => new Promise<{ createGiantImpact: typeof create }>(resolve => pending.push(resolve))
    const first = mountGiantImpact(options(), load)
    first(); first()
    const second = mountGiantImpact(options(), load)
    pending[0]({ createGiantImpact: create }); await flush()
    expect(create).not.toHaveBeenCalled()
    pending[1]({ createGiantImpact: create }); await flush()
    expect(create).toHaveBeenCalledTimes(1)
    second(); second()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('reports active import failure but suppresses a canceled import rejection', async () => {
    const live = options(), canceled = options()
    const error = new Error('chunk unavailable')
    mountGiantImpact(live, () => Promise.reject(error))
    const cleanup = mountGiantImpact(canceled, () => Promise.reject(error)); cleanup()
    await flush()
    expect(live.onFailure).toHaveBeenCalledExactlyOnceWith(error)
    expect(canceled.onFailure).not.toHaveBeenCalled()
  })

  it('reports construction failure through the static fallback path', async () => {
    const request = options(), error = new Error('WebGL unavailable')
    mountGiantImpact(request, async () => ({ createGiantImpact: () => { throw error } }))
    await flush()
    expect(request.onFailure).toHaveBeenCalledExactlyOnceWith(error)
  })
})

const source = readFileSync(new URL('./giantImpact/main.js', import.meta.url), 'utf8')

// Execute the production host/lifecycle code with a small GPU double. Skip only
// artwork construction and pose application; these checks make no visual/GPU claim.
function lifecycle(reduce = false, renderError = false) {
  function element() {
    const listeners = new Map<string, (event?: any) => void>()
    return {
      listeners, hidden: false, textContent: '', disabled: false, attributes: new Map<string, string>(),
      addEventListener: (key: string, fn: (event?: any) => void) => listeners.set(key, fn),
      removeEventListener: (key: string) => listeners.delete(key),
      setAttribute(key: string, value: string) { this.attributes.set(key, value) },
      removeAttribute(key: string) { this.attributes.delete(key) },
      emit(key: string, event?: any) { listeners.get(key)?.(event) },
    }
  }
  const document = { ...element(), hidden: false, defaultView: {} }
  const reduced = { ...element(), matches: reduce }
  document.defaultView = { matchMedia: () => reduced, devicePixelRatio: 1 }
  const canvas = { ...element(), width: 800, height: 600, remove: vi.fn() }
  const render = vi.fn(() => { if (renderError) throw new Error('shader failure') })
  const rendererDispose = vi.fn()
  const loseContext = vi.fn()
  let contextLost = false
  const renderer = { domElement: canvas, setClearColor() {}, setPixelRatio() {}, setSize() {}, render, dispose: rendererDispose, getContext: () => ({ isContextLost: () => contextLost }), forceContextLoss: loseContext, info: { render: { calls: 1, triangles: 1 } } }
  const textures: { dispose: ReturnType<typeof vi.fn>; loaded: (texture: any) => void; failed: (error: unknown) => void }[] = []
  const geometry = { dispose: vi.fn() }, material = { dispose: vi.fn() }
  const observers: { callback: (...args: any[]) => void; disconnect: ReturnType<typeof vi.fn> }[] = []
  class Observer {
    disconnect = vi.fn()
    constructor(readonly callback: (...args: any[]) => void) { observers.push(this) }
    observe() {}
  }
  let id = 0
  const frames = new Map<number, FrameRequestCallback>()
  const requestFrame = (fn: FrameRequestCallback) => { frames.set(++id, fn); return id }
  const cancelFrame = (id: number) => frames.delete(id)
  const stage = { ...element(), clientWidth: 800, clientHeight: 600, ownerDocument: document, appendChild: vi.fn() }
  const fallback = element(), controls = element(), pause = element(), replay = element(), onFailure = vi.fn()
  const request = { stage, fallback, controls, pause, replay, onFailure }
  const textureCode = source.slice(source.indexOf('  const L = new T.TextureLoader();'), source.indexOf('  cloudT.colorSpace'))
  const code = source.slice(source.indexOf('// The visual study'))
    .replace('export function', 'function')
    .replace(/  const S = new T.Scene\(\)[\s\S]*?(?=  let lastA =)/, `  const S = {}, C = { updateProjectionMatrix() {} }, earth = { uuid: 'earth' }, moon = { uuid: 'moon' }, tg = { uuid: 'theia' };\n${textureCode}\n  own(geometry); own(material); own(material);\n`)
    .replace(/  function apply\(t\) \{[\s\S]*?(?=  function draw\(\))/, '  function apply() {}\n')
  const three = {
    WebGLRenderer: class { constructor() { return renderer } },
    TextureLoader: class {
      load(_url: string, loaded: (texture: any) => void, _progress: unknown, failed: (error: unknown) => void) {
        const texture = { dispose: vi.fn(), loaded, failed }; textures.push(texture); return texture
      }
    },
  }
  const create = new Function('T', 'M', 'IntersectionObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'geometry', 'material', 'U_ROCK', 'U_EARTH', 'U_MOON', 'U_CLOUD', `${code}; return createGiantImpact`)(three, { DUR: 9.5, phase: () => 'study' }, Observer, Observer, requestFrame, cancelFrame, geometry, material, 'rock', 'earth', 'moon', 'cloud')
  const view = create(request)
  const tick = (now: number) => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(now)) }
  return { view, frames, tick, document, reduced, canvas, controls, pause, replay, fallback, textures, geometry, material, rendererDispose, loseContext, markContextLost() { contextLost = true }, render, observers, onFailure }
}

describe('Giant Impact lifecycle', () => {
  it('pause, play and replay keep a single clock and disposal releases resources and listeners once', () => {
    const h = lifecycle()
    expect(h.frames.size).toBe(1)
    h.tick(100); h.tick(150)
    expect(h.view.time).toBeCloseTo(.05)
    h.pause.emit('click'); expect(h.frames.size).toBe(0)
    expect(h.pause.textContent).toBe('Play')
    h.pause.emit('click'); expect(h.frames.size).toBe(1)
    h.replay.emit('click'); expect(h.view.time).toBe(0); expect(h.frames.size).toBe(1)
    h.view.dispose(); h.view.dispose()
    expect(h.frames.size).toBe(0)
    for (const target of [h.document, h.reduced, h.canvas, h.pause, h.replay]) expect(target.listeners.size).toBe(0)
    for (const resource of [...h.textures, h.geometry, h.material]) expect(resource.dispose).toHaveBeenCalledTimes(1)
    expect(h.rendererDispose).toHaveBeenCalledTimes(1)
    expect(h.loseContext).toHaveBeenCalledTimes(1)
    expect(h.canvas.remove).toHaveBeenCalledTimes(1)
    expect(h.observers.every(o => o.disconnect.mock.calls.length === 1)).toBe(true)
    const draws = h.render.mock.calls.length
    h.textures[0].loaded(h.textures[0]); h.observers[1].callback(); h.view.play()
    expect(h.render).toHaveBeenCalledTimes(draws)
    expect(h.frames.size).toBe(0)
  })

  it('visibility and intersection stop scheduling and reset the frame delta on resume', () => {
    const h = lifecycle()
    try {
      h.tick(100); h.tick(150)
      const time = h.view.time
      h.document.hidden = true; h.document.emit('visibilitychange')
      expect(h.frames.size).toBe(0)
      h.document.hidden = false; h.document.emit('visibilitychange')
      expect(h.frames.size).toBe(1)
      h.tick(5000); expect(h.view.time).toBe(time)
      h.observers[0].callback([{ isIntersecting: false }]); expect(h.frames.size).toBe(0)
      h.observers[0].callback([{ isIntersecting: true }]); expect(h.frames.size).toBe(1)
    } finally { h.view.dispose() }
  })

  it('initial and live reduced motion settle to the final state without automatic playback', () => {
    for (const initial of [true, false]) {
      const h = lifecycle(initial)
      try {
        if (!initial) { h.reduced.matches = true; h.reduced.emit('change') }
        expect(h.view.time).toBe(9.5); expect(h.frames.size).toBe(0)
        expect(h.pause.disabled).toBe(true); expect(h.replay.disabled).toBe(true)
        h.reduced.matches = false; h.reduced.emit('change')
        expect(h.pause.disabled).toBe(false); expect(h.frames.size).toBe(0)
        h.replay.emit('click'); expect(h.view.time).toBe(0); expect(h.frames.size).toBe(1)
      } finally { h.view.dispose() }
    }
  })

  it.each(['context', 'texture', 'render'])('%s failure disposes the runtime and restores the fallback', (kind) => {
    const h = lifecycle(false, kind === 'render')
    if (kind === 'context') {
      h.markContextLost()
      const preventDefault = vi.fn(); h.canvas.emit('webglcontextlost', { preventDefault })
      expect(preventDefault).toHaveBeenCalledTimes(1)
    }
    if (kind === 'texture') h.textures[0].failed(new Error('texture unavailable'))
    expect(h.frames.size).toBe(0)
    expect(h.controls.hidden).toBe(true)
    expect(h.fallback.attributes.has('hidden')).toBe(false)
    expect(h.onFailure).toHaveBeenCalledTimes(1)
    expect(h.rendererDispose).toHaveBeenCalledTimes(1)
    expect(h.loseContext).toHaveBeenCalledTimes(kind === 'context' ? 0 : 1)
    h.textures[1].failed(new Error('late failure')); h.view.dispose()
    expect(h.onFailure).toHaveBeenCalledTimes(1)
    expect(h.rendererDispose).toHaveBeenCalledTimes(1)
  })
})
