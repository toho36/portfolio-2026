import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDominantMotion } from '../shared/landingMotion'
import { mountGateReveal } from './gateReveal'

let doc: EventTarget & { hidden: boolean }
let media: EventTarget & { matches: boolean }
let win: EventTarget
let top: number
let pending: FrameRequestCallback | undefined
const section = { getBoundingClientRect: () => ({ top, height: 200 }) } as HTMLElement
const scrollTo = (value: number) => {
  top = value
  win.dispatchEvent(new Event('scroll'))
  const cb = pending; pending = undefined; cb?.(0)
}
beforeEach(() => {
  vi.clearAllMocks()
  doc = Object.assign(new EventTarget(), { hidden: false })
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('document', doc)
  top = 800; pending = undefined
  win = Object.assign(new EventTarget(), { innerHeight: 800, matchMedia: () => media })
  vi.stubGlobal('window', win)
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { pending = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn(() => { pending = undefined }))
})
afterEach(() => vi.unstubAllGlobals())

it('scrubs the rail both ways, preserves other owners, freezes hidden, and cleans up', async () => {
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal(section, rail, coordinator)
  await dispose.ready
  scrollTo(0)
  expect(rail.style.transform).toBe('scaleX(0.8)')
  scrollTo(600)
  expect(rail.style.transform).toBe('scaleX(0.2)')
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
  scrollTo(200)
  expect(rail.style.transform).toBe('scaleX(0.2)')
  doc.hidden = false
  coordinator.start('other-section', vi.fn())
  scrollTo(100)
  expect(rail.style.transform).toBe('scaleX(0.2)')
  coordinator.stop('other-section')
  scrollTo(-200)
  expect(rail.style.transform).toBe('scaleX(1)')
  scrollTo(800)
  expect(rail.style.transform).toBe('scaleX(0)')
  dispose(); dispose()
  coordinator.dispose()
})

it('settles the rail when reduced motion is enabled at runtime', async () => {
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal(section, rail, coordinator)
  await dispose.ready
  scrollTo(500)
  media.matches = true; media.dispatchEvent(new Event('change'))
  expect(rail.style.transform).toBe('scaleX(1)')
  dispose(); coordinator.dispose()
})

it('shows the complete rail for reduced motion', async () => {
  media.matches = true
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal(section, rail, coordinator)
  await dispose.ready
  expect(rail.style.transform).toBe('scaleX(1)')
  expect(requestAnimationFrame).not.toHaveBeenCalled()
  dispose(); coordinator.dispose()
})
