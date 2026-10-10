import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDominantMotion } from '../shared/landingMotion'
import { mountGateReveal } from './gateReveal'

const runtime = vi.hoisted(() => ({ create: vi.fn(), kill: vi.fn(), load: vi.fn() }))
vi.mock('../../../playground/loadRelayRuntime', () => ({ importRelayMotion: async () => {
  runtime.load()
  return { gsap: { registerPlugin() {}, ticker: { sleep() {}, wake() {} }, globalTimeline: { getChildren: () => [] } },
    ScrollTrigger: { create: runtime.create, getAll: () => [], getById: () => undefined, disable() {}, enable() {} } }
} }))
let doc: EventTarget & { hidden: boolean }
let media: EventTarget & { matches: boolean }
beforeEach(() => {
  vi.clearAllMocks()
  doc = Object.assign(new EventTarget(), { hidden: false })
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', { matchMedia: () => media })
  runtime.create.mockReturnValue({ kill: runtime.kill })
})
afterEach(() => vi.unstubAllGlobals())

it('scrubs the rail both ways, preserves other owners, freezes hidden, and cleans up', async () => {
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal({} as HTMLElement, rail, coordinator)
  await dispose.ready
  const trigger = runtime.create.mock.calls[0][0]
  trigger.onUpdate({ progress: .8, isActive: true })
  expect(rail.style.transform).toBe('scaleX(0.8)')
  trigger.onUpdate({ progress: .2, isActive: true })
  expect(rail.style.transform).toBe('scaleX(0.2)')
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
  trigger.onUpdate({ progress: .6, isActive: true })
  expect(rail.style.transform).toBe('scaleX(0.2)')
  doc.hidden = false
  coordinator.start('other-section', vi.fn())
  trigger.onUpdate({ progress: .7, isActive: true })
  expect(rail.style.transform).toBe('scaleX(0.2)')
  coordinator.stop('other-section')
  trigger.onUpdate({ progress: 1, isActive: false })
  expect(rail.style.transform).toBe('scaleX(1)')
  trigger.onUpdate({ progress: 0, isActive: false })
  expect(rail.style.transform).toBe('scaleX(0)')
  dispose(); dispose()
  expect(runtime.kill).toHaveBeenCalledOnce()
  coordinator.dispose()
})

it('settles the rail when reduced motion is enabled at runtime', async () => {
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal({} as HTMLElement, rail, coordinator)
  await dispose.ready
  runtime.create.mock.calls[0][0].onUpdate({ progress: .3, isActive: true })
  media.matches = true; media.dispatchEvent(new Event('change'))
  expect(rail.style.transform).toBe('scaleX(1)')
  expect(runtime.kill).toHaveBeenCalledOnce()
  dispose(); coordinator.dispose()
})

it('does not load the runtime for reduced motion', async () => {
  media.matches = true
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal({} as HTMLElement, rail, coordinator)
  await dispose.ready
  expect(rail.style.transform).toBe('scaleX(1)')
  expect(runtime.load).not.toHaveBeenCalled()
  dispose(); coordinator.dispose()
})
