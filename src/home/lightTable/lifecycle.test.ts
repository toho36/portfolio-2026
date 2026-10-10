import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { isLightTablePair } from '../../App'
import { getRouteNavigationUrl, pushRouteNavigation, subscribeToRouteChanges } from '../../content/routes'
import { BALL_DURATION, createBallFlow, createBallChoreography, captureBallOrientation, ballEase, firstBallPose, advanceBallOrientation, bridgeBallSpin } from './ballFlow.js'
import { stepSpin, followPosition } from './ballMotion.js'
import { ballEntryPresentation, ballContactLayout } from './ballScene.js'
import { staticLanding, staticStepImage } from './ballSteps.js'
import { deckPosition } from './model.js'

const source = readFileSync(new URL('./LightTable.jsx', import.meta.url), 'utf8')
const wrapper = readFileSync(new URL('./Volleyball.jsx', import.meta.url), 'utf8')
const effect = source.slice(source.indexOf('    if(!ballMounted)return'), source.indexOf('  },[ballMounted,ballDesired,reduced])'))
const sync = source.slice(source.indexOf("    const want=pathname==='/gameonvb'"), source.indexOf('  },[pathname])'))
// Execute the production effect bodies with the actual flow and measured layout.
// This proves handler ownership and clocks; it makes no browser/GPU claim.
const run = (code: string, context: Record<string, any>) => new Function('context', `with(context){${code}}`)(context)
const ref = (current: any) => ({ current })
function frames() {
  const queue = new Map<number, FrameRequestCallback>()
  let id = 0, now = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { queue.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  return { queue, tick() { now += 16; const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn(now)) } }
}
function handoff(cold = false) {
  const raf = frames(), calls: string[] = []
  const style = () => ({ setProperty(k: string, v: string) { (this as any)[k] = v }, cssText: '' })
  const image = { style: style(), dataset: {} }, surface = { style: style(), clientWidth: 600, clientHeight: 500, querySelector: () => image, getBoundingClientRect: () => ({ x: 201, y: 201 }) }
  const cta = { hidden: false, focus: () => calls.push('source-focus'), getBoundingClientRect: () => ({ top: 660, bottom: 700 }) }
  const band = {}, sheet = { clientTop: 1, parentElement: {}, closest: () => null, getBoundingClientRect: () => ({ top: 200, bottom: 700 }), querySelector: (q: string) => q === '.sheet-bottom' ? band : cta }
  const fan = { style: { ...style(), transform: 'translate(-49%,-51%)', width: '', height: '', left: '', top: '', transformOrigin: '' }, parentElement: { getBoundingClientRect: () => ({ x: 0, y: 0 }) }, getBoundingClientRect: () => ({ x: 200, y: 200 }), querySelectorAll: () => [{ getBoundingClientRect: () => ({ left: 180, right: 830, top: 170, bottom: 820 }) }] }
  const footer = { style: style() }, nav = { focus: () => calls.push('navigation-focus') }
  const view = { resize: () => calls.push('resize'), extend: () => calls.push('extend'), paint: () => calls.push('paint') }
  const host: any = { ballSurface: surface, ballView: view, dataset: { runtime: 'static', sourcePose: JSON.stringify({ x: .2, y: -.3, time: 9 }) }, closest: () => sheet, append: () => calls.push('append'), dispatchEvent: () => calls.push('event') }
  let headerHeight = 124.1875, resizeHeader = () => {}
  const header = { getBoundingClientRect: () => ({ height: headerHeight }) }
  const observed = vi.fn(), disconnected = vi.fn()
  const deck = { inert: false, removeAttribute() {}, closest: () => ({ querySelector: () => header }), querySelector: (q: string) => q === '.volleyball-view' ? host : q === '.sheet-fan' ? fan : q === '.table-footer' ? footer : nav }
  const slot = { append: () => calls.push('transfer') }
  const dialog: any = { open: cold, scrollTop: 400, dataset: {}, style: style(), querySelector: () => slot, show() { this.open = true; calls.push('show') }, close() { this.open = false; calls.push('close') } }
  const context: Record<string, any> = {
    history: { state: { lightTableFromHome: !cold } },
    mounted: false, desired: false, restoreRef: ref(null), desiredRef: ref(false), dialogScrollRef: ref(0), watchColdRef: ref(false), watchFragmentRef: ref(false), dialogRef: ref({ style: style() }), setDesired() {}, setMounted() {},
    ballMounted: true, ballDesired: true, reduced: false, pathname: '/gameonvb', coldRef: ref(cold), ballDialogRef: ref(dialog), deckRef: ref(deck), ballRestoreRef: ref(null), ballDesiredRef: ref(false), ballSourceRef: ref(cta), ballScrollRef: ref(cold ? 0 : 850), backRef: ref(cta), assistRef: ref({ cancel: () => calls.push('cancel') }),
    innerWidth: 1440, innerHeight: 1000, scrollY: cold ? 0 : 850, location: { hash: '' }, scrollStoryAnchor() {},
    document: { body: { style: { overflow: 'scroll' } }, createElement: () => ({ style: style(), remove: () => calls.push('steps-remove') }) },
    window: { scrollTo({ top }: { top: number }) { context.scrollY = top } },
    DOMMatrix: class { a = 1; b = 0; c = 0; d = 1; e = 0; f = 0 }, Event: class {},
    ResizeObserver: class { constructor(callback: () => void) { resizeHeader = callback } observe = observed; disconnect = disconnected },
    getComputedStyle: (o: any) => o === fan ? { width: '602px', height: '502px', left: '501px', top: '451px' } : o === sheet.parentElement ? { width: '602px', height: '502px', transform: 'none', transformOrigin: '301px 251px' } : o === band ? { top: '450px', height: '44px', paddingTop: '12px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' } : { width: '600', height: '500' },
    BALL_DURATION, createBallChoreography, captureBallOrientation, ballEase, ballEntryPresentation, ballContactLayout, staticLanding, staticStepImage, deckPosition,
    setBallPhase(value: string) { context.phase = value }, setPosition(value: number) { context.position = value }, setBallMounted(value: boolean) { context.ballMounted = value }, setBallDesired(value: boolean) { context.ballDesired = value },
  }
  host.ballFlow = createBallFlow(state => { context.clock = state; host.ballEntry?.paint(state.time); return false }, p => host.ballEntry?.land(p), { time: cold ? BALL_DURATION : 0, velocity: 0 })
  const apply = () => run(effect, context)
  const path = (pathname: string) => { context.pathname = pathname; run(sync, context); apply() }
  const cleanup = () => { context.ballRestoreRef.current?.(); host.ballFlow.destroy(); vi.unstubAllGlobals() }
  return { context, host, view, surface, dialog, fan, calls, raf, apply, path, cleanup, header, observed, disconnected, resizeHeader(height: number) { headerHeight = height; resizeHeader() } }
}

function coldFragment(cold = true, readyState = 'loading', hash = '#payment-matches', pathname = '/gameonvb') {
  const h = handoff(cold), listeners = new Map<string, Set<() => void>>()
  const scrollingElement = { scrollTop: 0 }
  const target = { scrollIntoView: vi.fn(() => { scrollingElement.scrollTop = 2641 }) }
  Object.assign(h.context, {
    pathname, location: { pathname, hash }, coldFragmentRef: ref(cold),
    addEventListener(key: string, callback: () => void) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key)!.add(callback) },
    removeEventListener(key: string, callback: () => void) { listeners.get(key)?.delete(callback) },
  })
  Object.assign(h.context.document, { readyState, scrollingElement, getElementById: vi.fn(() => target) })
  h.dialog.contains = (node: unknown) => node === target
  const anchor = source.slice(source.indexOf('  function scrollStoryAnchor()'), source.indexOf('  use', source.indexOf('  function scrollStoryAnchor()')))
  h.context.scrollStoryAnchor = run(`${anchor};return scrollStoryAnchor`, h.context)
  // Run all pathname layout effects preceding the normal keyboard/hash handlers.
  // Before the fix this runs only the header/path sync, so the race remains visible.
  const layout = source.slice(0, source.indexOf('    const escape=event=>'))
  const mount = () => {
    const cleanups = [...layout.matchAll(/  useLayoutEffect\(\(\)=>\{([\s\S]*?)\n  \},\[pathname\]\)/g)].map(match => run(match[1], h.context))
    return () => cleanups.reverse().forEach(cleanup => cleanup?.())
  }
  return { ...h, target, scrollingElement, listeners, mount, emit(key: string) { listeners.get(key)?.forEach(callback => callback()) } }
}

it.each(['load', 'pageshow'])('cold fragment restores the same anchor once after native scroll reset and %s', event => {
  const h = coldFragment(), unmount = h.mount()
  try {
    h.apply(); h.raf.tick()
    expect(h.scrollingElement.scrollTop).toBe(2641)
    expect(h.target.scrollIntoView).toHaveBeenCalledTimes(1)
    const clock = h.host.ballFlow.state, orientation = structuredClone(h.host.ballEntry.orientation)
    h.emit(event)
    expect(h.raf.queue.size).toBe(0)
    h.context.document.readyState = 'complete'
    h.emit(event); h.emit('load'); h.emit('pageshow')
    expect(h.scrollingElement.scrollTop).toBe(2641)
    expect(h.raf.queue.size).toBe(1)
    h.raf.tick()
    expect(h.target.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(h.scrollingElement.scrollTop).toBe(2641)
    expect(h.context.coldFragmentRef.current).toBe(true)
    expect(h.raf.queue.size).toBe(1)
    h.emit('load'); h.emit('pageshow')
    expect(h.raf.queue.size).toBe(1)
    // Simulate native restoration after the first frame's paint.
    h.scrollingElement.scrollTop = 0
    h.raf.tick()
    expect(h.scrollingElement.scrollTop).toBe(2641)
    expect(h.target.scrollIntoView).toHaveBeenCalledTimes(2)
    expect(h.context.coldFragmentRef.current).toBe(false)
    expect(h.raf.queue.size).toBe(0)
    expect(h.context.document.getElementById.mock.calls).toEqual([['payment-matches'], ['payment-matches']])
    expect(h.host.ballFlow.state).toEqual(clock)
    expect(h.host.ballEntry.orientation).toEqual(orientation)
    expect(h.context.phase).toBe('open')
    h.emit('load'); h.emit('pageshow'); h.raf.tick()
    expect(h.target.scrollIntoView).toHaveBeenCalledTimes(2)
    expect(h.raf.queue.size).toBe(0)
  } finally { unmount(); h.cleanup() }
})

it.each([['loading', 0], ['complete', 0], ['complete', 1]] as const)('cold fragments survive StrictMode setup-cleanup-setup while %s after %i frames', (readyState, elapsedFrames) => {
  const h = coldFragment(true, readyState)
  const firstCleanup = h.mount()
  try {
    expect(h.raf.queue.size).toBe(readyState === 'complete' ? 1 : 0)
    if (elapsedFrames) h.raf.tick()
    firstCleanup()
    expect(h.raf.queue.size).toBe(0)
    expect(h.context.coldFragmentRef.current).toBe(true)
    expect([...h.listeners.values()].every(callbacks => callbacks.size === 0)).toBe(true)
    const unmount = h.mount()
    try {
      h.apply()
      expect(h.target.scrollIntoView).toHaveBeenCalledTimes(1)
      h.scrollingElement.scrollTop = 0
      h.context.document.readyState = 'complete'
      h.emit('load'); h.emit('pageshow')
      h.raf.tick()
      expect(h.scrollingElement.scrollTop).toBe(0)
      expect(h.target.scrollIntoView).toHaveBeenCalledTimes(1)
      expect(h.context.coldFragmentRef.current).toBe(true)
      expect(h.raf.queue.size).toBe(1)
      h.raf.tick()
      expect(h.scrollingElement.scrollTop).toBe(2641)
      expect(h.target.scrollIntoView).toHaveBeenCalledTimes(2)
      h.emit('pageshow'); h.raf.tick()
      expect(h.target.scrollIntoView).toHaveBeenCalledTimes(2)
    } finally { unmount() }
  } finally { firstCleanup(); h.cleanup() }
})

it.each([['loading', 0], ['complete', 0], ['complete', 1]] as const)('leaving a cold route cancels restoration ownership on rapid return while %s after %i frames', (readyState, elapsedFrames) => {
  const h = coldFragment(true, readyState), firstCleanup = h.mount()
  try {
    if (elapsedFrames) h.raf.tick()
    expect(h.context.coldFragmentRef.current).toBe(true)
    firstCleanup()
    expect(h.raf.queue.size).toBe(0)
    h.context.pathname = h.context.location.pathname = '/'
    const leaveCleanup = h.mount()
    leaveCleanup()
    expect(h.context.coldRef.current).toBe(true)
    expect(h.context.coldFragmentRef.current).toBe(false)
    h.context.pathname = h.context.location.pathname = '/gameonvb'
    h.context.document.readyState = 'complete'
    const returnCleanup = h.mount()
    try {
      expect(h.raf.queue.size).toBe(0)
      expect([...h.listeners.values()].every(callbacks => callbacks.size === 0)).toBe(true)
      h.emit('load'); h.emit('pageshow'); h.raf.tick(); h.raf.tick()
      expect(h.target.scrollIntoView).not.toHaveBeenCalled()
    } finally { returnCleanup() }
  } finally { firstCleanup(); h.cleanup() }
})

it.each([['loading', 0], ['complete', 0], ['complete', 1]] as const)('cold fragment cleanup cancels listeners and pending work while %s after %i frames', (readyState, elapsedFrames) => {
  const h = coldFragment(true, readyState), unmount = h.mount()
  try {
    if (readyState === 'loading') {
      expect(h.listeners.get('load')?.size).toBe(1)
      expect(h.listeners.get('pageshow')?.size).toBe(1)
    } else expect(h.raf.queue.size).toBe(1)
    if (elapsedFrames) h.raf.tick()
    expect(h.raf.queue.size).toBe(readyState === 'complete' ? 1 : 0)
    expect(h.context.coldFragmentRef.current).toBe(true)
    unmount()
    expect([...h.listeners.values()].every(callbacks => callbacks.size === 0)).toBe(true)
    expect(h.raf.queue.size).toBe(0)
    h.context.document.readyState = 'complete'
    h.emit('load'); h.emit('pageshow'); h.raf.tick(); h.raf.tick()
    expect(h.target.scrollIntoView).not.toHaveBeenCalled()
    expect(h.context.coldFragmentRef.current).toBe(true)
  } finally { unmount(); h.cleanup() }
})

it.each([
  { cold: false, hash: '#payment-matches', pathname: '/gameonvb' },
  { cold: true, hash: '', pathname: '/gameonvb' },
  { cold: true, hash: '#payment-matches', pathname: '/' },
])('warm, fragmentless, and other-route entries own no restoration frame: %j', ({ cold, hash, pathname }) => {
  const h = coldFragment(cold, 'complete', hash, pathname), unmount = h.mount()
  try {
    h.emit('load'); h.emit('pageshow')
    expect(h.raf.queue.size).toBe(0)
    expect(h.listeners.size).toBe(0)
    expect(h.target.scrollIntoView).not.toHaveBeenCalled()
  } finally { unmount(); h.cleanup() }
})

it.each(['route', 'hash', 'back', 'warm'].flatMap(change => [0, 1].map(elapsedFrames => ({ change, elapsedFrames }))))('pending cold fragment does not override a changed $change after $elapsedFrames frames', ({ change, elapsedFrames }) => {
  const h = coldFragment(true, 'complete'), unmount = h.mount()
  try {
    expect(h.raf.queue.size).toBe(1)
    if (elapsedFrames) h.raf.tick()
    if (change === 'route') h.context.location.pathname = '/'
    if (change === 'hash') h.context.location.hash = '#event-opens'
    if (change === 'back') h.context.ballDesiredRef.current = false
    if (change === 'warm') h.context.coldRef.current = false
    h.raf.tick(); h.raf.tick()
    expect(h.target.scrollIntoView).not.toHaveBeenCalled()
    expect(h.raf.queue.size).toBe(0)
  } finally { unmount(); h.cleanup() }
})

it('measures the local shell header on pathname sync and observes wrapping changes with cleanup', () => {
  const h = handoff()
  try {
    const cleanup = run(sync, h.context)
    expect(h.dialog.style['--shell-header-height']).toBe('124.1875px')
    expect(h.observed).toHaveBeenCalledExactlyOnceWith(h.header)
    h.resizeHeader(151.625)
    expect(h.dialog.style['--shell-header-height']).toBe('151.625px')
    cleanup()
    expect(h.disconnected).toHaveBeenCalledTimes(1)
  } finally { h.cleanup() }
})

it('keeps App pathname normalization and modified/middle clicks browser-owned', () => {
  expect(isLightTablePair('/', '/gameonvb/')).toBe(true)
  expect(isLightTablePair('/gameonvb/', '/')).toBe(true)
  expect(isLightTablePair('/goal-loop', '/gameonvb')).toBe(true)
  expect(isLightTablePair('/', '/')).toBe(false)
  const input = { href: '/gameonvb', currentUrl: 'https://portfolio.test/', button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: '', download: false }
  expect(getRouteNavigationUrl(input)).toBe('/gameonvb')
  for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { target: '_blank' }, { download: true }]) expect(getRouteNavigationUrl({ ...input, ...change })).toBeNull()
})

it('production pathname reversals retain the current view, surface, contact and physical clock', () => {
  const h = handoff()
  try {
    h.apply()
    for (let i = 0; i < 95; i++) h.raf.tick()
    const entry = h.host.ballEntry, flow = h.host.ballFlow, state = flow.state, orientation = entry.orientation
    expect(state.time).toBeGreaterThan(1)
    h.dialog.scrollTop = 1100
    h.path('/')
    expect(h.dialog.scrollTop).toBe(0)
    expect(h.host.ballEntry).toBe(entry)
    expect(h.host.ballView).toBe(h.view)
    expect(h.host.ballSurface).toBe(h.surface)
    expect(h.host.ballFlow).toBe(flow)
    expect(flow.state).toEqual(state)
    expect(entry.orientation).toBe(orientation)
    h.raf.tick(); h.raf.tick()
    const reversing = flow.state
    h.path('/gameonvb')
    expect(flow.state).toEqual(reversing)
    expect(h.calls.filter(c => c === 'extend')).toHaveLength(1)
    h.path('/')
    for (let i = 0; i < 400; i++) h.raf.tick()
    expect(h.host.ballEntry).toBeUndefined()
    expect(h.context.scrollY).toBe(850)
    expect(h.context.position).toBe(1)
    expect(h.fan.style.transform).toBe('translate(-49%,-51%)')
    expect(h.context.document.body.style.overflow).toBe('scroll')
    expect(h.calls.at(-1)).toBe('source-focus')
  } finally { h.cleanup() }
})

it('cold production handoff starts settled, exposes story fragments, and returns to scroll zero', () => {
  const h = handoff(true)
  try {
    h.apply()
    expect(h.dialog.dataset.flightTime).toBe(BALL_DURATION.toFixed(5))
    expect(h.host.ballFlow.state).toEqual({ time: BALL_DURATION, velocity: 0 })
    h.raf.tick()
    expect(h.context.phase).toBe('open')
    h.path('/')
    for (let i = 0; i < 400; i++) h.raf.tick()
    expect(h.context.scrollY).toBe(0)
    expect(h.context.position).toBe(0)
    expect(h.context.coldRef.current).toBe(false)
  } finally { h.cleanup() }
})

const runtimeEffect = wrapper.slice(wrapper.indexOf('  useEffect(()=>{') + '  useEffect(()=>{'.length, wrapper.indexOf('  },[active,reduced])')).replace("Promise.all([import('three'),import('./ballScene.js')])", 'loadView()')
function runtime() {
  const raf = frames(), events = new Map<string, () => void>()
  let intersect!: (entries: { isIntersecting: boolean }[]) => void
  const image = { style: {}, dataset: {} }, slot = {}, surface = { dataset: {}, querySelector: () => image, closest: () => slot, addEventListener() {}, removeEventListener() {} }
  const sheet = { closest: () => null, addEventListener() {}, removeEventListener() {} }
  const doc = { hidden: false, querySelector: () => null, addEventListener: (k: string, fn: () => void) => events.set(k, fn), removeEventListener: (k: string) => events.delete(k) }
  const pose = { x: .2, y: .1, time: 8, spin: { yaw: 2, pitch: 1, yawSpeed: 1, pitchSpeed: 0 } }
  const entry = { want: true, source: { width: 600, height: 500 }, screenWidth: 1440, screenHeight: 1000, pose, choreography: createBallChoreography({ support: [.2, -.9, 0], corner: [-2, -1.05, 0] }, pose), orientation: captureBallOrientation(pose), resize() {}, paint() {}, land() {} }
  const host: any = { ballSurface: surface, ownerDocument: doc, closest: () => sheet, dataset: {}, ballEntry: entry, addEventListener: (k: string, fn: () => void) => events.set(k, fn), removeEventListener: (k: string) => events.delete(k) }
  const pending: ((modules: any[]) => void)[] = [], views: any[] = []
  const context: Record<string, any> = { ref: ref(host), clockRef: ref({ time: 1.2, velocity: 1 }), timeRef: ref(8), spinRef: ref(pose.spin), positionRef: ref({ x: .2, y: .1 }), previewRef: ref('same-model'), innerWidth: 1440, innerHeight: 1000, active: true, reduced: false, createBallFlow, BALL_DURATION, firstBallPose, advanceBallOrientation, bridgeBallSpin, stepSpin, followPosition,
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(fn: typeof intersect) { intersect = fn } observe(target: unknown) { expect(target).toBe(slot) } disconnect() {} },
    loadView: () => new Promise(resolve => pending.push(resolve)),
  }
  const viewFactory = () => {
    const view = { frame: { width: 1440, height: 1000 }, entryProjection: {}, resize() {}, extend() {}, paint() {}, paintEntry() {}, snapshotPose: () => 'scene', snapshot: () => 'same-model', destroy: vi.fn() }
    views.push(view); return view
  }
  const resolve = async () => { pending.shift()?.([{}, { createVolleyball: viewFactory }]); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
  const cleanup = run(runtimeEffect, context)
  return { context, host, entry, raf, pending, views, resolve, hide() { intersect([{ isIntersecting: false }]) }, show() { intersect([{ isIntersecting: true }]) }, cleanup() { cleanup(); vi.unstubAllGlobals() } }
}

it('offscreen story cancels a pending import and resumes the preserved flow exactly once', async () => {
  const h = runtime()
  try {
    const clock = h.host.ballFlow.state, orientation = structuredClone(h.entry.orientation)
    expect(h.pending).toHaveLength(1)
    h.hide()
    expect(h.raf.queue.size).toBe(0)
    await h.resolve()
    expect(h.views).toHaveLength(0)
    expect(h.host.ballFlow.state).toEqual(clock)
    expect(h.entry.orientation).toEqual(orientation)
    h.show(); h.show()
    expect(h.pending).toHaveLength(1)
    await h.resolve()
    expect(h.views).toHaveLength(1)
    expect(h.raf.queue.size).toBe(1)
    h.hide(); h.hide()
    expect(h.views[0].destroy).toHaveBeenCalledTimes(1)
    expect(h.host.ballView).toBeUndefined()
    expect(h.raf.queue.size).toBe(0)
  } finally { h.cleanup() }
})

it('unmount cancels pending view creation and all frame ownership', async () => {
  const h = runtime()
  h.cleanup()
  await h.resolve()
  expect(h.views).toHaveLength(0)
  expect(h.raf.queue.size).toBe(0)
  expect(h.host.ballFlow).toBeUndefined()
})

it('Back and Escape use App navigation even after native story fragments', () => {
  const handler = source.slice(source.indexOf('  function ballBack('), source.indexOf('  useLayoutEffect(()=>{\n    if(!ballMounted)'))
  const navigate = vi.fn((event: { preventDefault(): void }) => event.preventDefault())
  const context: Record<string, any> = { location: { href: 'https://portfolio.test/gameonvb#payment-matches', hash: '#payment-matches' }, desiredRef: ref(false), ballDesiredRef: ref(true), coldRef: ref(false), setBallDesired: vi.fn(), getRouteNavigationUrl, onNavigate: navigate, backRef: ref(null) }
  const back = run(`${handler};return ballBack`, context)
  const event = { button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, currentTarget: { target: '' }, preventDefault: vi.fn() }
  context.backRef.current = { click: () => back(event) }
  back()
  expect(navigate).toHaveBeenCalledTimes(1)
  expect(event.preventDefault).toHaveBeenCalledTimes(1)
  back()
  expect(navigate).toHaveBeenCalledTimes(1)
  context.ballDesiredRef.current = true
  back({ ...event, metaKey: true })
  expect(navigate).toHaveBeenCalledTimes(1)
  expect(context.ballDesiredRef.current).toBe(true)
})

function returnHandlers(h: ReturnType<typeof handoff>, cold = false, fragment = false) {
  const urls = cold ? ['https://outside.test/', 'https://portfolio.test/gameonvb'] : ['https://portfolio.test/', 'https://portfolio.test/gameonvb']
  if (fragment) urls.push('https://portfolio.test/gameonvb#event-opens', 'https://portfolio.test/gameonvb#payment-matches')
  const states: unknown[] = urls.map((_url, i) => i === 0 ? null : { lightTableFromHome: !cold })
  let index = urls.length - 1
  const location = new URL(urls[index]), listeners = new Map<string, (event: any) => void>()
  const history = {
    state: states[index], back: vi.fn(),
    pushState(state: unknown, _unused: string, path: string) { urls.splice(++index); states.splice(index); urls[index] = new URL(path, location.href).href; states[index] = history.state = state; location.href = urls[index] },
  }
  const target = { location, addEventListener: (key: string, callback: (event: any) => void) => listeners.set(key, callback), removeEventListener: (key: string) => listeners.delete(key) }
  const unsubscribe = subscribeToRouteChanges(target as unknown as Window, route => h.path(route.path))
  const navigate = vi.fn((event: { preventDefault(): void }) => { event.preventDefault(); h.path(pushRouteNavigation('/', location.href, history as unknown as History).path) })
  Object.assign(h.context, { location, history, getRouteNavigationUrl, onNavigate: navigate, ballDesiredRef: ref(true),
    document: { ...h.context.document, addEventListener: target.addEventListener, removeEventListener: target.removeEventListener },
    addEventListener() {}, removeEventListener() {},
  })
  const handler = source.slice(source.indexOf('  function ballBack('), source.indexOf('  useLayoutEffect(()=>{\n    if(!ballMounted)'))
  const back = run(`${handler};return ballBack`, h.context)
  h.context.ballBack = back
  const event = () => ({ button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, currentTarget: { target: '' }, preventDefault: vi.fn() })
  h.context.backRef.current = { click: () => back(event()), focus() {} }
  const escapeEffect = source.slice(source.indexOf('    const escape=event=>'), source.indexOf('  },[])', source.indexOf('    const escape=event=>')))
  const removeEscape = run(escapeEffect, h.context)
  return { history, navigate, location, event, back, escape() { const key = { key: 'Escape', defaultPrevented: false, preventDefault: vi.fn() }; listeners.get('keydown')!(key); return key },
    traverse(direction: number) { index += direction; history.state = states[index]; location.href = urls[index]; listeners.get('popstate')!({}) },
    cleanup() { removeEscape(); unsubscribe() },
  }
}

it('warm native Back and Escape return through history, suppress repeats, and Forward reverses the same clock', () => {
  for (const useEscape of [false, true]) {
    const h = handoff(), handlers = returnHandlers(h)
    try {
      h.apply()
      for (let i = 0; i < 95; i++) h.raf.tick()
      const entry = h.host.ballEntry, flow = h.host.ballFlow, state = flow.state, orientation = entry.orientation
      const event = handlers.event()
      if (useEscape) expect(handlers.escape().preventDefault).toHaveBeenCalledTimes(1)
      else { handlers.back(event); expect(event.preventDefault).toHaveBeenCalledTimes(1) }
      expect(handlers.history.back).toHaveBeenCalledTimes(1)
      expect(handlers.navigate).not.toHaveBeenCalled()
      expect(h.context.ballDesiredRef.current).toBe(false)
      expect(h.context.ballDesired).toBe(false)
      handlers.escape(); handlers.back(handlers.event())
      expect(handlers.history.back).toHaveBeenCalledTimes(1)
      // Native popstate is asynchronous. Apply the requested state before it arrives.
      h.apply()
      expect(flow.state).toEqual(state)
      handlers.traverse(-1)
      expect(handlers.location.pathname).toBe('/')
      h.raf.tick(); h.raf.tick()
      const reversing = flow.state
      handlers.traverse(1)
      expect(handlers.location.pathname).toBe('/gameonvb')
      expect(flow.state).toEqual(reversing)
      expect(h.host.ballEntry).toBe(entry)
      expect(h.host.ballView).toBe(h.view)
      expect(h.host.ballSurface).toBe(h.surface)
      expect(entry.orientation).toBe(orientation)
      expect(h.calls.filter(call => call === 'extend')).toHaveLength(1)
    } finally { handlers.cleanup(); h.cleanup() }
  }
})

it('cold direct Back reaches actual home at scroll zero and fragment Back bypasses prior fragments', () => {
  for (const cold of [true, false]) {
    const h = handoff(cold), handlers = returnHandlers(h, cold, !cold)
    try {
      h.apply(); handlers.escape(); handlers.escape()
      expect(handlers.history.back).not.toHaveBeenCalled()
      expect(handlers.navigate).toHaveBeenCalledTimes(1)
      expect(handlers.location.href).toBe('https://portfolio.test/')
      for (let i = 0; i < 400; i++) h.raf.tick()
      expect(h.context.scrollY).toBe(cold ? 0 : 850)
    } finally { handlers.cleanup(); h.cleanup() }
  }
})

it('production Back leaves modifiers, middle clicks and already handled clicks browser-owned', () => {
  const h = handoff(), handlers = returnHandlers(h)
  try {
    for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { currentTarget: { target: '_blank' } }, { defaultPrevented: true }]) {
      const event = { ...handlers.event(), ...change }
      handlers.back(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(h.context.ballDesiredRef.current).toBe(true)
    }
    expect(handlers.history.back).not.toHaveBeenCalled()
    expect(handlers.navigate).not.toHaveBeenCalled()
  } finally { handlers.cleanup(); h.cleanup() }
})
