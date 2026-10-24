import { afterEach, expect, it, vi } from 'vitest'
import { startContactDeparture } from './contactEnvelope'
import { createContactFormController } from '../useContactForm'
import { sendContact } from '../contactForm'

vi.mock('../contactForm', async original => ({ ...await original<typeof import('../contactForm')>(), sendContact: vi.fn() }))

function fixture(reduced = false) {
  const media = Object.assign(new EventTarget(), { matches: reduced })
  const win = Object.assign(new EventTarget(), { matchMedia: () => media })
  const doc = Object.assign(new EventTarget(), { defaultView: win, activeElement: null as unknown, body: {} })
  const status = { focus: vi.fn() }
  const root = {
    dataset: {} as Record<string, string>, isConnected: true, ownerDocument: doc,
    contains: (element: unknown) => element === root,
    closest: vi.fn(() => null), querySelector: vi.fn(() => status),
  }
  doc.activeElement = root
  return { root: root as unknown as HTMLElement, status, media, win, doc }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetAllMocks() })

it('starts departure only after transport success, keeping pending and failed input for retry', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  const f = fixture()
  let stop = () => {}
  const c = createContactFormController(state => {
    if (state.sent && !f.root.dataset.send) stop = startContactDeparture(f.root)
  })
  c.update('name', 'Vitek'); c.update('email', 'vitek@example.com'); c.update('message', 'A sufficiently long project message.')
  const values = { ...c.state.values }
  let resolve!: (success: boolean) => void
  vi.mocked(sendContact).mockImplementation(() => new Promise(done => { resolve = done }))
  const first = c.submit({ preventDefault() {} })
  expect(c.state.sending).toBe(true)
  expect(f.root.dataset.send).toBeUndefined()
  resolve(false); await first
  expect(c.state.sent).toBe(false)
  expect(c.state.values).toEqual(values)
  expect(f.root.dataset.send).toBeUndefined()
  const retry = c.submit({ preventDefault() {} })
  resolve(true); await retry
  expect(f.root.dataset.send).toBe('wrapping')
  expect(f.status.focus).not.toHaveBeenCalled()
  vi.advanceTimersByTime(2200)
  expect(f.root.dataset.send).toBe('settled')
  expect(f.status.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  expect(vi.getTimerCount()).toBe(0)
  stop()
})

it.each([true, false])('settles reduced motion immediately and never replays (initial=%s)', initial => {
  vi.useFakeTimers()
  const f = fixture(initial), stop = startContactDeparture(f.root)
  if (!initial) { f.media.matches = true; f.media.dispatchEvent(new Event('change')) }
  expect(f.root.dataset.send).toBe('settled')
  expect(vi.getTimerCount()).toBe(0)
  expect(f.status.focus).toHaveBeenCalledOnce()
  f.media.matches = false; f.media.dispatchEvent(new Event('change'))
  expect(f.root.dataset.send).toBe('settled')
  expect(vi.getTimerCount()).toBe(0)
  stop()
})

it('settles honeypot confirmation without departure', () => {
  vi.useFakeTimers()
  const f = fixture(), stop = startContactDeparture(f.root, false)
  expect(f.root.dataset.send).toBe('settled')
  expect(vi.getTimerCount()).toBe(0)
  stop()
})

it.each(['homecontactready', 'homefragmentfocus', 'homefragmentnavigate', 'hashchange', 'popstate'])('settles synchronously before %s measures the stable anchor, without taking navigation focus', event => {
  vi.useFakeTimers()
  const f = fixture(), stop = startContactDeparture(f.root)
  const target = ['hashchange', 'popstate'].includes(event) ? f.win : f.doc
  target.dispatchEvent(new Event(event))
  expect(f.root.dataset.send).toBe('settled')
  expect(vi.getTimerCount()).toBe(0)
  expect(f.status.focus).not.toHaveBeenCalled()
  stop()
})

it('cleans timers and listeners on unmount without focusing or replaying', () => {
  vi.useFakeTimers()
  const f = fixture(), stop = startContactDeparture(f.root)
  expect(vi.getTimerCount()).toBe(1)
  stop()
  expect(vi.getTimerCount()).toBe(0)
  f.media.matches = true; f.media.dispatchEvent(new Event('change'))
  f.doc.dispatchEvent(new Event('homecontactready'))
  vi.runAllTimers()
  expect(f.status.focus).not.toHaveBeenCalled()
})

it('focuses the static receipt when making the sent form inert has released focus to the body', () => {
  vi.useFakeTimers()
  const f = fixture()
  f.doc.activeElement = f.doc.body
  const stop = startContactDeparture(f.root)
  vi.runAllTimers()
  expect(f.status.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  stop()
})

it('clears departure on a normal link navigation before a retained homepage becomes inert', () => {
  vi.useFakeTimers()
  const f = fixture(), stop = startContactDeparture(f.root)
  const anchor = { target: '', hasAttribute: () => false }
  const click = Object.assign(new Event('click'), { button: 0 })
  Object.defineProperty(click, 'target', { value: { closest: () => anchor } })
  f.doc.dispatchEvent(click)
  expect(f.root.dataset.send).toBe('settled')
  expect(vi.getTimerCount()).toBe(0)
  expect(f.status.focus).not.toHaveBeenCalled()
  stop()
})

it.each(['other-focus', 'inert', 'detached'])('does not steal focus after %s', reason => {
  vi.useFakeTimers()
  const f = fixture(), stop = startContactDeparture(f.root)
  if (reason === 'other-focus') f.doc.activeElement = {}
  if (reason === 'inert') vi.mocked(f.root.closest).mockReturnValue({} as Element)
  if (reason === 'detached') Object.assign(f.root, { isConnected: false })
  vi.runAllTimers()
  expect(f.status.focus).not.toHaveBeenCalled()
  expect(f.root.dataset.send).toBe('settled')
  stop()
})
