import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createPosterRuntime, serveArc } from './posterRuntime'
import { CMS_BLOCKS, CMS_DURATION, GOAL_DURATION, GOAL_EVENTS, sampleCmsBlock, sampleGoalLoop } from './posterTimelines'

class FakeRenderer { static last: FakeRenderer; domElement = { style: {}, setAttribute() {}, remove: vi.fn() }; autoClear=true
  constructor() { FakeRenderer.last = this }
  setClearColor() {} setScissorTest() {} setPixelRatio() {} setSize() {} setViewport=vi.fn(); setScissor=vi.fn(); clear() {} render=vi.fn((_scene: any, _camera: any) => {}); dispose=vi.fn()
}
const three = { ...THREE, WebGLRenderer: FakeRenderer, TextureLoader: class { load() { return new THREE.Texture() } } }

afterEach(() => vi.unstubAllGlobals())

describe('posterRuntime', () => {
  it('flies CMS blocks in without snapping, types after landing, then publishes', () => {
    expect(CMS_DURATION).toBe(3600)
    expect(CMS_BLOCKS.map((block) => block.delay)).toEqual([100, 320, 540, 760, 980, 1200])
    for (let i = 0; i < CMS_BLOCKS.length; i++) {
      const { delay, x, y, fromX, fromY } = CMS_BLOCKS[i]
      const start = sampleCmsBlock(i, delay)
      expect(start).toMatchObject({ visible: true, landed: false, x: x + fromX, y: y + fromY, lines: 0 })
      expect(sampleCmsBlock(i, delay + 350).x).not.toBe(start.x)
      expect(sampleCmsBlock(i, delay + 699).x).toBeCloseTo(x, 2)
      expect(sampleCmsBlock(i, delay + 700)).toMatchObject({ landed: true, x, y, lines: 0 })
      expect(sampleCmsBlock(i, delay + 1100).lines).toBe(1)
      expect(Math.max(...[0, 175, 350, 525, 700].map((ms) => sampleCmsBlock(i, delay + ms).scale))).toBeLessThanOrEqual(1.04)
      expect(Math.abs(start.rotation)).toBeLessThanOrEqual(Math.PI / 60)
    }
    const lastLands = CMS_BLOCKS.at(-1)!.delay + 700
    expect(sampleCmsBlock(5, lastLands).progress).toBe(0)
    expect(sampleCmsBlock(5, 2299).progress).toBe(0)
    expect(sampleCmsBlock(5, 2500).cursor).toBeGreaterThan(0)
    expect(sampleCmsBlock(5, 3199).progress).toBeLessThan(1)
    expect(sampleCmsBlock(5, 3200).progress).toBe(1)
    expect(sampleCmsBlock(5, 3200).published).toBe(0)
    expect(sampleCmsBlock(5, 3500).published).toBe(1)
    expect(sampleCmsBlock(5, CMS_DURATION).published).toBe(1)
  })

  it('rejects CHECK once, repairs, then passes before the final verdict', () => {
    expect(GOAL_DURATION).toBe(3200)
    expect(GOAL_EVENTS.every((event, index) => index === 0 || event.at > GOAL_EVENTS[index - 1].at)).toBe(true)
    expect(GOAL_EVENTS.at(-1)!.at).toBe(GOAL_DURATION)
    expect(GOAL_EVENTS.filter((event) => event.kind === 'reject')).toHaveLength(1)
    expect(GOAL_EVENTS.filter((event) => event.kind === 'check-pass')).toHaveLength(1)
    expect(GOAL_EVENTS.find((event) => event.kind === 'reject')!.at).toBeLessThan(GOAL_EVENTS.find((event) => event.kind === 'check-pass')!.at)
    expect(sampleGoalLoop(1320)).toMatchObject({ position: 3, rejected: true, returned: true, checkPassed: false })
    expect(sampleGoalLoop(1510)).toMatchObject({ position: 2.5, side: -1 })
    expect(sampleGoalLoop(1700)).toMatchObject({ position: 2, repair: 0 })
    expect(sampleGoalLoop(1890)).toMatchObject({ position: 2, repair: 1 })
    expect(sampleGoalLoop(2160)).toMatchObject({ position: 3, rejected: false, checkPassed: true })
    expect(sampleGoalLoop(2540).lit).toEqual([true, true, true, true, true])
    expect(sampleGoalLoop(3000)).toMatchObject({ position: 5, verdict: false })
    expect(sampleGoalLoop(GOAL_DURATION)).toMatchObject({ position: 5, verdict: true, repair: 1 })
    for (const key of [360, 680, 1000, 1320, 1510, 1700, 1890, 2160, 2540, 3000]) {
      expect(Math.abs(sampleGoalLoop(key - 1).position - sampleGoalLoop(key).position)).toBeLessThan(.001)
      expect(Math.abs(sampleGoalLoop(key - 1).side - sampleGoalLoop(key).side)).toBeLessThan(.001)
    }
  })
  it('serves above the net and lands inside the far court near its attack line', () => {
    const atNet = serveArc(10.2 / 13.6)
    const landing = serveArc(1)
    expect(atNet.z).toBeCloseTo(0)
    expect(atNet.y).toBeGreaterThan(2.43)
    expect(Math.abs(landing.x)).toBeLessThan(4.5)
    expect(landing.z).toBeGreaterThan(-9)
    expect(landing.z).toBeLessThan(-3)
    expect(landing.y).toBeCloseTo(.28)
  })

  it('renders one first frame, caps bend, and releases its RAF, listeners and canvas', () => {
    const windowListeners = new Map<string, Function>(), documentListeners = new Map<string, Function>()
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrame = 0
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 3,
      addEventListener: (name: string, fn: Function) => windowListeners.set(name,fn),
      removeEventListener: (name: string) => windowListeners.delete(name) })
    vi.stubGlobal('document', { hidden: false,
      createElement: () => {
        const canvas = { width: 0, height: 0, text: '', getContext: () => ({ measureText: (value: string) => ({ width: value.length * 58 }), fillText: (value: string) => { canvas.text = value } }) }
        return canvas
      },
      addEventListener: (name: string, fn: Function) => documentListeners.set(name,fn),
      removeEventListener: (name: string) => documentListeners.delete(name) })
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { callbacks.set(++nextFrame,fn); return nextFrame })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
    vi.stubGlobal('performance', { now: () => 10 })
    const host = { appendChild: vi.fn() } as unknown as HTMLElement
    let cmsRect = {left:-100,right:700,top:100,bottom:700,width:800,height:600}
    const slots = Array.from({length: 7}, (_, index) => ({ getBoundingClientRect: () => index === 2
      ? cmsRect
      : {left:0,right:800,top:0,bottom:600,width:800,height:600} })) as HTMLElement[]
    const onFirstFrame = vi.fn()
    const runtime = createPosterRuntime(three, { host, slots, accents: [], reducedMotion:false, onFirstFrame })
    expect(windowListeners.has('resize')).toBe(true)
    expect(documentListeners.has('visibilitychange')).toBe(true)
    runtime.setActive(1)
    runtime.setBend(3)
    const [id, frame] = callbacks.entries().next().value!
    callbacks.delete(id); frame(20)
    expect(onFirstFrame).toHaveBeenCalledTimes(1)
    expect(FakeRenderer.last.setViewport).toHaveBeenCalledWith(-100, 100, 800, 600)
    expect(FakeRenderer.last.setScissor).toHaveBeenCalledWith(0, 100, 700, 600)
    const cms = FakeRenderer.last.render.mock.calls[1][0].children[0]
    const row = cms.children.find((node: any) => Math.abs(node.geometry?.parameters?.height - 3.56 * .11) < .001)
    const label = cms.children.find((node: any) => node.isSprite && node.material.map.image.text === '✓ Published')
    expect(row).toBeTruthy()
    expect(label).toBeTruthy()
    expect(label.position.y - label.scale.y / 2).toBeGreaterThan(row.position.y - row.geometry.parameters.height / 2)
    expect(label.position.y + label.scale.y / 2).toBeLessThan(row.position.y + row.geometry.parameters.height / 2)
    expect(label.position.x + label.scale.x / 2).toBeLessThan(5.56 / 2)
    for (const rect of [
      {left:0,right:800,top:0,bottom:200,width:800,height:200},
      {left:0,right:360,top:0,bottom:640,width:360,height:640},
    ]) {
      cmsRect = rect
      const [nextId, nextFrame] = callbacks.entries().next().value!
      callbacks.delete(nextId); nextFrame(40 + nextId)
      expect(1.85 * cms.scale.x).toBeLessThanOrEqual(4 * rect.height / rect.width)
    }
    expect(cms.rotation.x).toBe(0)
    runtime.setPointer(5, -1)
    for (let i = 0; i < 40 && callbacks.size; i++) {
      const [pointerId, pointerFrame] = callbacks.entries().next().value!
      callbacks.delete(pointerId); pointerFrame(100 + i * 16)
    }
    expect(cms.position.x).toBe(0)
    expect(cms.rotation.x).toBeCloseTo(-.32)
    expect(cms.rotation.y).toBeCloseTo(.45)
    runtime.destroy()
    expect(windowListeners.size).toBe(0)
    expect(documentListeners.size).toBe(0)
    expect(callbacks.size).toBe(0)
    expect(host.appendChild).toHaveBeenCalledTimes(1)
    expect((host.appendChild as ReturnType<typeof vi.fn>).mock.calls[0][0].remove).toHaveBeenCalledTimes(1)
  })
})
