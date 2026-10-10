import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { createWatchFlow } from './watchFlow.js'
import { BALL_DURATION, createBallFlow, createBallChoreography, captureBallOrientation, ballEase, firstBallPose, advanceBallOrientation, bridgeBallSpin } from './ballFlow.js'
import { stepSpin, followPosition } from './ballMotion.js'
import { ballEntryPresentation, ballContactLayout } from './ballScene.js'
import { staticLanding, staticStepImage } from './ballSteps.js'
import { deckPosition } from './model.js'
import { isLightTablePair, selectHomeTransition } from '../../App'
import { getRouteNavigationUrl, normalizePathname, pushRouteNavigation } from '../../content/routes'

const source = readFileSync(new URL('./LightTable.jsx', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
const appStart = appSource.indexOf('    const anchor = event.currentTarget')
const appNavigation = appSource.slice(appStart, appSource.indexOf('\n  }, [])', appStart)).replace('querySelector<HTMLElement>', 'querySelector')
const run = (code: string, context: Record<string, any>) => new Function('context', `with(context){${code}}`)(context)
const ref = (current: any) => ({ current })

it('actual JSX source ball yields GPU cleanup to the incoming watch only after the outgoing ball returns', async () => {
  const expression = source.match(/<Volleyball\b[^>]*\bactive=\{([^}]+)\}/)![1]
  const wrapper = readFileSync(new URL('./Volleyball.jsx', import.meta.url), 'utf8')
  const effect = wrapper.slice(wrapper.indexOf('  useEffect(()=>{') + '  useEffect(()=>{'.length, wrapper.indexOf('  },[active,reduced])')).replace("Promise.all([import('three'),import('./ballScene.js')])", 'loadView()')
  const state = { position: 1, ballMounted: false, mounted: false, restoreRef: ref(null) }
  const active = () => run(`return (${expression})`, state)
  const queue = new Map<number, FrameRequestCallback>(); let id = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { queue.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  const image = { style: {}, dataset: {}, src: '' }, canvas = { parentElement: null as any }
  const surface = { dataset: {}, querySelector: () => image, addEventListener() {}, removeEventListener() {} }
  const deck = { dataset: { position: '1.000', settling: 'false' } }, cta = { hidden: false }
  const sheet = { closest: (q: string) => q === '.light-table' ? deck : null, querySelector: () => cta, addEventListener() {}, removeEventListener() {} }
  const doc = { hidden: false, querySelector: () => state.mounted || state.restoreRef.current ? {} : null, addEventListener() {}, removeEventListener() {} }
  const host: any = { ballSurface: surface, ownerDocument: doc, closest: () => sheet, dataset: {}, addEventListener() {}, removeEventListener() {} }
  const view = { paint() {}, snapshot: () => 'same-ball-pose', destroy: vi.fn(() => { canvas.parentElement = null }) }
  const context = { ref: ref(host), clockRef: ref({ time: 0, velocity: 0 }), timeRef: ref(8), spinRef: ref({ yaw: 2, pitch: 1, yawSpeed: 1, pitchSpeed: 0 }), positionRef: ref({ x: .2, y: .1 }), previewRef: ref('same-model'), active: active(), reduced: false,
    createBallFlow, BALL_DURATION, firstBallPose, advanceBallOrientation, bridgeBallSpin, stepSpin, followPosition,
    ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    loadView: async () => [{}, { createVolleyball() { canvas.parentElement = surface; return view } }],
  }
  let cleanup = () => {}
  const commit = () => {
    const next = active()
    if (next === context.active) return
    cleanup(); context.active = next; cleanup = run(effect, context)
  }
  try {
    expect(context.active).toBe(true)
    cleanup = run(effect, context)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(host.ballView).toBe(view); expect(canvas.parentElement).toBe(surface)
    const flow = host.ballFlow, clock = context.clockRef.current, spin = context.spinRef.current
    state.ballMounted = true
    commit()
    state.mounted = true; state.restoreRef.current = () => {}
    expect(active()).toBe(true); commit()
    expect(host.ballView).toBe(view); expect(host.ballFlow).toBe(flow)
    expect(canvas.parentElement).toBe(surface); expect(view.destroy).not.toHaveBeenCalled()
    state.ballMounted = false
    commit()
    expect(view.destroy).toHaveBeenCalledTimes(1)
    expect(host.ballView).toBeUndefined(); expect(canvas.parentElement).toBeNull()
    expect(host.ballSurface).toBe(surface); expect(queue.size).toBe(0)
    expect(context.clockRef.current).toBe(clock); expect(context.spinRef.current).toBe(spin)
    expect(image.src).toBe('same-ball-pose')
    expect(active()).toBe(false)
    state.mounted = false; expect(active()).toBe(false)
    state.ballMounted = true; expect(active()).toBe(true)
    state.ballMounted = false; state.restoreRef.current = null; expect(active()).toBe(true)
    state.mounted = true; expect(active()).toBe(false)
  } finally { cleanup(); vi.unstubAllGlobals() }
})

function harness(cold = false) {
  const queue = new Map<number, FrameRequestCallback>(); let id = 0, now = 0, maxOpen = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { queue.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  const style = () => ({ cssText: 'original inline style', setProperty(k: string, v: string) { (this as any)[k] = v } })
  const focus: string[] = []
  const makeHost = (name: string) => {
    const cta = { hidden: false, focus: () => focus.push(name), getBoundingClientRect: () => ({ top: 660, bottom: 700 }) }
    const band = {}, sheet = { clientTop: 1, parentElement: {}, closest: () => null, getBoundingClientRect: () => ({ top: 200, bottom: 700 }), querySelector: (q: string) => q === '.sheet-bottom' ? band : cta }
    const image = { style: style(), dataset: {} }, surface: any = { style: style(), clientWidth: 600, clientHeight: 500, querySelector: () => image, getBoundingClientRect: () => ({ x: 201.25, y: 200.75 }) }
    const host: any = { dataset: { runtime: 'webgl', sourcePose: JSON.stringify({ x: .2, y: -.3, time: 9 }) }, closest: () => sheet, append(s: any) { s.parentElement = this }, dispatchEvent() {} }
    host.append(surface)
    return { host, surface, sheet, band, cta }
  }
  const watch = makeHost('watch'), ball = makeHost('ball')
  const view = { pose: { time: 8, open: .73 }, resize: vi.fn(), paint: vi.fn() }
  watch.host.watchSurface = watch.surface; watch.host.watchView = view
  ball.host.ballSurface = ball.surface; ball.host.ballView = { resize() {}, extend() {}, paint() {} }
  const makeDialog = () => {
    const slot = { append(s: any) { s.parentElement = this } }
    return { open: false, scrollTop: 500, dataset: {}, style: style(), contains: () => true, querySelector: () => slot,
      show() { this.open = true; maxOpen = Math.max(maxOpen, Number(dialog.open) + Number(ballDialog.open)) }, close() { this.open = false } }
  }
  const dialog = makeDialog(), ballDialog = makeDialog()
  const fan = { style: { ...style(), transform: 'translate(-49%,-51%)', width: '', height: '', left: '', top: '', transformOrigin: '' }, parentElement: { getBoundingClientRect: () => ({ x: 0, y: 0 }) }, getBoundingClientRect: () => ({ x: 200, y: 200 }), querySelectorAll: () => [{ getBoundingClientRect: () => ({ left: 180, right: 830, top: 170, bottom: 820 }) }] }
  const footer = { style: style() }, header = { getBoundingClientRect: () => ({ height: 125.25 }) }
  const deck = { style: style(), inert: false, removeAttribute() {}, closest: () => ({ querySelector: () => header }), querySelector: (q: string) => q === '.watch-view' ? watch.host : q === '.volleyball-view' ? ball.host : q === '.sheet-fan' ? fan : q === '.table-footer' ? footer : watch.cta }
  const context: Record<string, any> = {
    pathname: cold ? '/goal-loop' : '/', mounted: cold, desired: cold, ballMounted: false, ballDesired: false, reduced: false, position: 0,
    dialogRef: ref(dialog), flowRef: ref(null), restoreRef: ref(null), desiredRef: ref(cold), sourceRef: ref(watch.cta), dialogScrollRef: ref(0), watchColdRef: ref(cold), watchFragmentRef: ref(cold), watchBackRef: ref(watch.cta),
    ballDialogRef: ref(ballDialog), ballDesiredRef: ref(false), ballSourceRef: ref(ball.cta), ballScrollRef: ref(850), ballRestoreRef: ref(null), coldRef: ref(false), backRef: ref(ball.cta),
    deckRef: ref(deck), assistRef: ref({ cancel() {} }), innerWidth: 1440, innerHeight: 1000, scrollY: cold ? 0 : 13,
    location: new URL(cold ? '/goal-loop' : '/', 'https://portfolio.test/'), history: { state: null, back: vi.fn() }, getRouteNavigationUrl, onNavigate: vi.fn(),
    document: { hidden: false, body: { style: { overflow: 'scroll' } }, createElement: () => ({ style: style(), remove() {} }) },
    addEventListener() {}, removeEventListener() {},
    window: { scrollTo({ top }: { top: number }) { context.scrollY = top } }, scrollStoryAnchor() {},
    DOMMatrix: class { a = .83; b = -.05; c = .05; d = .83; e = 0; f = 0 }, Event: class {}, ResizeObserver: class { observe() {} disconnect() {} },
    getComputedStyle: (o: any) => o === fan ? { width: '602px', height: '502px', left: '501px', top: '451px' } : o === ball.sheet.parentElement || o === watch.sheet.parentElement ? { width: '602px', height: '502px', transform: 'matrix', transformOrigin: '301px 251px' } : o === ball.band ? { top: '450px', height: '44px', paddingTop: '12px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' } : { width: '600', height: '500' },
    createWatchFlow, BALL_DURATION, createBallChoreography, captureBallOrientation, ballEase, ballEntryPresentation, ballContactLayout, staticLanding, staticStepImage, deckPosition,
    setPhase(v: string) { context.phase = v }, setBallPhase(v: string) { context.ballPhase = v }, setPosition(v: number) { context.position = v },
  }
  for (const key of ['mounted', 'desired', 'ballMounted', 'ballDesired']) context[`set${key[0].toUpperCase() + key.slice(1)}`] = (v: boolean) => { context[key] = v }
  ball.host.ballFlow = createBallFlow(s => { ball.host.ballEntry?.paint(s.time); return false }, p => ball.host.ballEntry?.land(p))
  const sync = source.slice(source.indexOf("    const want=pathname==='/gameonvb'"), source.indexOf('  },[pathname])'))
  const ballEffect = source.slice(source.indexOf('    if(!ballMounted)return'), source.indexOf('  },[ballMounted,ballDesired,reduced])'))
  const start = source.indexOf('    if(!mounted)return')
  const watchEffect = start < 0 ? '' : source.slice(start, source.indexOf('  },[mounted,desired,reduced])'))
  let ballDeps = '', watchDeps = ''
  function commit() {
    for (let i = 0; i < 10; i++) {
      const b = [context.ballMounted, context.ballDesired, context.reduced].join(), w = [context.mounted, context.desired, context.reduced].join()
      if (b === ballDeps && w === watchDeps) return
      if (b !== ballDeps) { ballDeps = b; run(ballEffect, context) }
      if (w !== watchDeps) { watchDeps = w; run(watchEffect, context) }
    }
    throw new Error('commit did not settle')
  }
  function path(pathname: string) { context.pathname = context.location.pathname = pathname; run(sync, context); commit() }
  function tick() { now += 16; const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn(now)); commit(); expect(maxOpen).toBeLessThanOrEqual(1); expect(context.document.body.style.overflow).toBe(dialog.open || ballDialog.open ? 'hidden' : 'scroll') }
  function settle() { for (let i = 0; i < 400; i++) tick() }
  function cleanup() { context.flowRef.current?.destroy(); ball.host.ballFlow.destroy(); context.restoreRef.current?.(); context.ballRestoreRef.current?.(); expect(queue.size).toBe(0); vi.unstubAllGlobals() }
  return { context, watch, ball, dialog, ballDialog, deck, fan, footer, view, focus, path, tick, settle, commit, cleanup }
}

function navigation(h: ReturnType<typeof harness>) {
  const c = h.context, entries = [{ url: c.location.href, state: null as any }], keys = new Map<string, (e: any) => void>()
  let index = 0
  c.history = {
    get state() { return entries[index].state },
    back: vi.fn(),
    pushState(state: unknown, _unused: string, path: string) {
      entries.splice(++index); entries[index] = { url: new URL(path, c.location.href).href, state }
      c.location.href = entries[index].url
    },
    replaceState(state: unknown, _unused: string, url: string) { entries[index] = { url, state }; c.location.href = url },
  }
  Object.assign(c.window, { location: c.location, history: c.history })
  Object.assign(c, { normalizePathname, pushRouteNavigation, isLightTablePair, selectHomeTransition,
    setUnknownPath() {}, setRoute(route: { path: string }) { h.path(route.path) },
  })
  const navigate = new Function('event', 'context', `with(context){${appNavigation}}`)
  c.onNavigate = vi.fn((e: any) => navigate(e, c))
  const handlers = source.slice(source.indexOf('  function enter('), source.indexOf('  useLayoutEffect(()=>{\n    if(!ballMounted)'))
  const { enter, back, ballBack } = run(`${handlers};return {enter,back,ballBack}`, c)
  const event = (href: string) => ({ button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    currentTarget: { ...(href === '/gameonvb' ? h.ball.cta : h.watch.cta), target: '', getAttribute: () => href, hasAttribute: () => false, closest: () => null }, preventDefault: vi.fn() })
  c.back = back; c.ballBack = ballBack
  c.watchBackRef.current = { click: () => back(event('/')), focus() {} }
  c.backRef.current = { click: () => ballBack(event('/')), focus() {} }
  c.document.addEventListener = (key: string, fn: (e: any) => void) => keys.set(key, fn)
  c.document.removeEventListener = (key: string) => keys.delete(key)
  const start = source.indexOf('    const escape=event=>')
  const cleanup = run(source.slice(start, source.indexOf('  },[])', start)), c)
  return {
    enter(path: string) { enter(event(path)) }, sibling(path: string) { c.onNavigate(event(path)) },
    exit(path: string, escape: boolean) {
      if (escape) keys.get('keydown')!({ key: 'Escape', defaultPrevented: false, preventDefault: vi.fn() })
      else (path === '/goal-loop' ? back : ballBack)(event('/'))
    },
    fragment(hash: string) { c.history.pushState(c.history.state, '', `${c.location.pathname}${hash}`); c.location.hash = hash },
    traverse(direction: number) { index += direction; const entry = entries[index]; c.location.href = entry.url; h.path(c.location.pathname) }, entries, cleanup,
  }
}

it.each([
  ['/gameonvb', '/goal-loop', false], ['/gameonvb', '/goal-loop', true],
  ['/goal-loop', '/gameonvb', false], ['/goal-loop', '/gameonvb', true],
] as const)('Home -> %s -> %s returns Back/Escape=%s to actual Home after incoming land(0)', (outgoing, incoming, escape) => {
  const h = harness(), c = h.context, n = navigation(h)
  try {
    n.enter(outgoing)
    for (let i = 0; i < 210; i++) h.tick()
    if (outgoing === '/gameonvb') expect(h.ball.host.ballFlow.state.time / BALL_DURATION).toBeGreaterThan(.9)
    n.sibling(incoming); h.settle()
    const flow = incoming === '/goal-loop' ? c.flowRef.current : h.ball.host.ballFlow
    const before = flow.state, host = incoming === '/goal-loop' ? h.watch : h.ball
    h.path(incoming); c.reduced = true; h.commit(); c.reduced = false; h.commit()
    expect(c.history.state?.lightTableFromHome === true).toBe(false)
    const sourceScroll = incoming === '/goal-loop' ? c.dialogScrollRef.current : c.ballScrollRef.current
    c.onNavigate.mockClear()
    n.exit(incoming, escape); n.exit(incoming, escape)
    expect(c.onNavigate).toHaveBeenCalledOnce(); expect(c.onNavigate.mock.calls[0][0].currentTarget.getAttribute('href')).toBe('/')
    expect(c.history.back).not.toHaveBeenCalled(); expect(c.pathname).toBe('/')
    expect(flow.state).toEqual(before); expect(c.document.body.style.overflow).toBe('hidden')
    expect(host.surface.parentElement).not.toBe(host.host)
    h.tick(); expect(host.surface.parentElement).not.toBe(host.host)
    h.settle()
    expect(c.pathname).toBe('/'); expect(c.document.body.style.overflow).toBe('scroll')
    expect(flow.state).toEqual(incoming === '/goal-loop' ? { position: 0, velocity: 0 } : { time: 0, velocity: 0 })
    expect(c.scrollY).toBe(sourceScroll)
    expect(c.restoreRef.current).toBeNull(); expect(c.ballRestoreRef.current).toBeNull()
    expect(h.watch.surface.parentElement).toBe(h.watch.host); expect(h.ball.surface.parentElement).toBe(h.ball.host)
    expect(h.dialog.open || h.ballDialog.open).toBe(false)
  } finally { n.cleanup(); h.cleanup() }
})

it.each([
  ['/gameonvb', '/goal-loop', false], ['/gameonvb', '/goal-loop', true],
  ['/goal-loop', '/gameonvb', false], ['/goal-loop', '/gameonvb', true],
] as const)('Home -> %s -> %s -> Home -> native Back -> case Back/Escape=%s ends at Home', (outgoing, incoming, escape) => {
  const h = harness(), c = h.context, n = navigation(h)
  try {
    n.enter(outgoing); h.settle(); n.sibling(incoming); h.settle()
    n.exit(incoming, false); h.settle()
    expect(c.location.href).toBe('https://portfolio.test/')
    expect(n.entries.map(entry => new URL(entry.url).pathname)).toEqual(['/', outgoing, incoming, '/'])
    n.traverse(-1); h.settle()
    expect(c.location.href).toBe(`https://portfolio.test${incoming}`)
    const flow = incoming === '/goal-loop' ? c.flowRef.current : h.ball.host.ballFlow, before = flow.state
    c.onNavigate.mockClear(); c.history.back.mockClear()
    n.exit(incoming, escape); n.exit(incoming, escape)
    // Resolve a requested native Back as the browser would, exposing the wrong sibling destination.
    if (c.history.back.mock.calls.length) n.traverse(-1)
    expect(c.location.href).toBe('https://portfolio.test/')
    expect(c.onNavigate).toHaveBeenCalledOnce(); expect(c.history.back).not.toHaveBeenCalled()
    expect(flow.state).toEqual(before); expect(c.document.body.style.overflow).toBe('hidden')
    h.settle()
    expect(c.location.href).toBe('https://portfolio.test/'); expect(c.document.body.style.overflow).toBe('scroll')
    expect(c.restoreRef.current).toBeNull(); expect(c.ballRestoreRef.current).toBeNull()
    expect(h.watch.surface.parentElement).toBe(h.watch.host); expect(h.ball.surface.parentElement).toBe(h.ball.host)
    expect(h.dialog.open || h.ballDialog.open).toBe(false)
  } finally { n.cleanup(); h.cleanup() }
})

it.each([
  ['/goal-loop', false], ['/goal-loop', true], ['/gameonvb', false], ['/gameonvb', true],
] as const)('Home card -> %s Back/Escape=%s and Forward retain home history and interrupted entry', (path, escape) => {
  const h = harness(), c = h.context, n = navigation(h)
  try {
    n.enter(path); for (let i = 0; i < 12; i++) h.tick()
    const flow = path === '/goal-loop' ? c.flowRef.current : h.ball.host.ballFlow, state = flow.state
    h.path(path); c.onNavigate.mockClear(); n.exit(path, escape); n.exit(path, escape)
    expect(c.history.back).toHaveBeenCalledOnce(); expect(c.onNavigate).not.toHaveBeenCalled()
    h.commit(); expect(flow.state).toEqual(state)
    expect(c.document.body.style.overflow).toBe('hidden')
    const host = path === '/goal-loop' ? h.watch : h.ball
    expect(host.surface.parentElement).not.toBe(host.host)
    n.traverse(-1); expect(c.location.href).toBe('https://portfolio.test/'); h.tick(); h.tick(); const reverse = flow.state
    n.traverse(1); expect(c.location.href).toBe(`https://portfolio.test${path}`); expect(flow.state).toEqual(reverse)
    expect(path === '/goal-loop' ? c.flowRef.current : h.ball.host.ballFlow).toBe(flow)
    expect(c.history.state?.lightTableFromHome === true).toBe(true)
    h.path(path); c.reduced = true; h.commit(); c.reduced = false; h.commit()
    n.exit(path, escape)
    expect(c.history.back).toHaveBeenCalledTimes(2); expect(c.onNavigate).not.toHaveBeenCalled()
    n.traverse(-1); h.settle(); expect(c.pathname).toBe('/'); expect(c.document.body.style.overflow).toBe('scroll')
    expect(host.surface.parentElement).toBe(host.host)
    expect(c.restoreRef.current).toBeNull(); expect(c.ballRestoreRef.current).toBeNull()
    n.traverse(1); h.settle()
    expect(c.location.href).toBe(`https://portfolio.test${path}`)
    expect(path === '/goal-loop' ? h.dialog.open : h.ballDialog.open).toBe(true)
    expect(c.document.body.style.overflow).toBe('hidden')
    expect(host.surface.parentElement).not.toBe(host.host)
    c.history.back.mockClear(); n.exit(path, escape)
    expect(c.history.back).toHaveBeenCalledOnce(); expect(c.onNavigate).not.toHaveBeenCalled()
    n.traverse(-1); h.settle()
    expect(c.location.href).toBe('https://portfolio.test/'); expect(c.document.body.style.overflow).toBe('scroll')
    expect(host.surface.parentElement).toBe(host.host)
  } finally { n.cleanup(); h.cleanup() }
})

it.each([
  ['/goal-loop', 'cold'], ['/gameonvb', 'cold'], ['/goal-loop', 'hash'], ['/gameonvb', 'hash'],
] as const)('%s %s Back/Escape keeps explicit Home navigation', (path, entry) => {
  const h = harness(), c = h.context, n = navigation(h)
  try {
    if (entry === 'cold') {
      c.scrollY = c.dialogScrollRef.current = c.ballScrollRef.current = 0
      if (path === '/goal-loop') c.watchColdRef.current = c.desiredRef.current = c.mounted = c.desired = true
      else c.coldRef.current = c.ballDesiredRef.current = c.ballMounted = c.ballDesired = true
      c.history.replaceState(null, '', `https://portfolio.test${path}`)
      h.path(path)
      expect(c.history.state?.lightTableFromHome === true).toBe(false)
    } else {
      n.enter(path); h.settle(); n.fragment('#story')
    }
    c.onNavigate.mockClear(); n.exit(path, true); n.exit(path, false)
    expect(c.onNavigate).toHaveBeenCalledOnce(); expect(c.history.back).not.toHaveBeenCalled()
    expect(c.pathname).toBe('/'); h.settle(); expect(c.document.body.style.overflow).toBe('scroll')
    if (entry === 'cold') expect(c.scrollY).toBe(0)
  } finally { n.cleanup(); h.cleanup() }
})

it('actual production watch handler retains affine/view/backing and restores source styles/scroll/focus', () => {
  const h = harness()
  try {
    h.path('/goal-loop')
    expect(h.context.restoreRef.current).toBeTypeOf('function')
    expect(h.dialog.open).toBe(true); expect(h.watch.surface.parentElement).not.toBe(h.watch.host)
    expect(h.watch.surface.style.cssText).toContain('width:600px;height:500px')
    expect(h.watch.surface.style.transform).toBe('matrix(0.83,-0.05,0.05,0.83,201.25,230.75)')
    for (let i = 0; i < 12; i++) h.tick()
    const flow = h.context.flowRef.current, state = flow.state
    h.path('/'); expect(flow.state).toEqual(state); h.tick(); h.tick()
    const reversing = flow.state; h.path('/goal-loop'); expect(flow.state).toEqual(reversing)
    expect(h.watch.host.watchView).toBe(h.view)
    expect(h.view.resize).not.toHaveBeenCalled()
    h.view.resize.mockReturnValue(true)
    h.path('/'); h.settle()
    expect(h.view.paint).toHaveBeenCalledWith(8, .73)
    expect(h.watch.surface.parentElement).toBe(h.watch.host)
    for (const node of [h.watch.surface, h.deck, h.fan, h.footer]) expect(node.style.cssText).toBe('original inline style')
    expect(h.context.scrollY).toBe(13); expect(h.focus.at(-1)).toBe('watch')
    expect(h.context.flowRef.current).toBeNull()
  } finally { h.cleanup() }
})

it.each([['/goal-loop', '/gameonvb'], ['/gameonvb', '/goal-loop']])('serial real-path %s -> %s waits for restore and cancels interrupted incoming mounts', (outgoing, incoming) => {
  const h = harness()
  try {
    h.path(outgoing); h.settle()
    const watchFlow = h.context.flowRef.current, ballFlow = h.ball.host.ballFlow
    h.path(incoming)
    expect(h.context[outgoing === '/goal-loop' ? 'ballMounted' : 'mounted']).toBe(false)
    for (let i = 0; i < 8; i++) h.tick()
    h.path(outgoing)
    expect(h.context[outgoing === '/goal-loop' ? 'ballMounted' : 'mounted']).toBe(false)
    expect(outgoing === '/goal-loop' ? h.context.flowRef.current : h.ball.host.ballFlow).toBe(outgoing === '/goal-loop' ? watchFlow : ballFlow)
    h.settle(); h.path(incoming); h.settle()
    expect(h.dialog.open).toBe(incoming === '/goal-loop'); expect(h.ballDialog.open).toBe(incoming === '/gameonvb')
    h.path('/'); h.settle()
    expect(h.context.restoreRef.current).toBeNull(); expect(h.context.ballRestoreRef.current).toBeNull()
  } finally { h.cleanup() }
})

it('cold real watch route starts at rest and returns source zero without a home visit', () => {
  const h = harness(true)
  try {
    h.commit(); expect(h.context.flowRef.current?.state).toEqual({ position: 1, velocity: 0 })
    h.tick(); expect(h.context.phase).toBe('open')
    h.path('/'); h.settle(); expect(h.context.scrollY).toBe(0); expect(h.context.position).toBe(0)
    expect(h.context.watchColdRef.current).toBe(false)
  } finally { h.cleanup() }
})

const watchSource = readFileSync(new URL('./Watch.jsx', import.meta.url), 'utf8')
const watchRuntime = watchSource.slice(watchSource.indexOf('  useEffect(()=>{') + '  useEffect(()=>{'.length, watchSource.indexOf('  },[active,reduced])')).replace("Promise.all([import('three'),import('./watchScene.js')])", 'loadView()')
function runtime(reduced = false, hidden = false) {
  const queue = new Map<number, FrameRequestCallback>(); let id = 0, now = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { queue.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id))
  const events = new Map<string, (event?: any) => void>(), slot = {}, dialog = { open: true }
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => { throw new Error('watch did not observe its native hero') }
  const image = { style: {}, src: '' }, surface = { dataset: {}, querySelector: () => image, closest: (selector: string) => selector === 'dialog[open]' ? dialog : slot,
    addEventListener: (key: string, fn: () => void) => events.set(key, fn), removeEventListener: (key: string) => events.delete(key) }
  const sheet = { closest: () => null, addEventListener() {}, removeEventListener() {} }
  const doc = { hidden, querySelector: () => null, addEventListener: (key: string, fn: () => void) => events.set(key, fn), removeEventListener: (key: string) => events.delete(key) }
  const pose = { time: 8, amount: .73 }, flow = createWatchFlow(() => {}, () => {}, { position: .3, velocity: 1.2 })
  const entry = { pose: { time: 8, open: .73 }, flow }
  const host: any = { watchSurface: surface, ownerDocument: doc, closest: () => sheet, dataset: {}, watchEntry: entry,
    addEventListener: (key: string, fn: () => void) => events.set(key, fn), removeEventListener: (key: string) => events.delete(key) }
  const pending: ((modules: any[]) => void)[] = [], views: any[] = []
  const context: Record<string, any> = { ref: ref(host), poseRef: ref(pose), previewRef: ref(null), active: true, reduced,
    matchMedia: () => ({ matches: false }),
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(fn: typeof intersect) { intersect = fn } observe(target: unknown) { expect(target).toBe(slot) } disconnect() {} },
    loadView: () => new Promise(resolve => pending.push(resolve)),
  }
  const resolve = async () => {
    pending.shift()?.([{}, { createWatch() {
      const view = { pose: { time: 0, open: 0 }, resize: () => false, paint(time: number, open: number) { this.pose = { time, open } }, snapshotPose: () => 'same-watch-pose', destroy: vi.fn() }
      views.push(view); return view
    } }]); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  }
  const cleanup = run(watchRuntime, context)
  return { context, pose, entry, host, views, pending, flow, queue, resolve, events,
    tick() { now += 16; const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn(now)) },
    hide() { intersect([{ isIntersecting: false }]) }, show() { intersect([{ isIntersecting: true }]) },
    cleanup() { cleanup?.(); flow.destroy(); expect(queue.size).toBe(0); vi.unstubAllGlobals() } }
}

it('actual watch wrapper invalidates pending offscreen imports, freezes reveal and resumes one same-pose renderer', async () => {
  const h = runtime()
  try {
    expect(h.pending).toHaveLength(1)
    h.hide(); await h.resolve(); expect(h.views).toHaveLength(0); expect(h.queue.size).toBe(0)
    const phase = { ...h.pose }, progress = h.flow.state
    h.show(); h.show(); expect(h.pending).toHaveLength(1); await h.resolve()
    expect(h.views).toHaveLength(1); expect(h.views[0].pose).toEqual({ time: phase.time, open: phase.amount })
    expect(h.flow.state).toEqual(progress)
    for (let i = 0; i < 12; i++) h.tick()
    expect(h.pose.time).toBeGreaterThan(phase.time); expect(h.pose.amount).toBe(.73)
    h.hide(); h.hide(); expect(h.views[0].destroy).toHaveBeenCalledTimes(1); expect(h.queue.size).toBe(0)
    const saved = { ...h.pose }; h.show(); await h.resolve()
    expect(h.views[1].pose).toEqual({ time: saved.time, open: saved.amount })
    h.context.ref.current.ownerDocument.hidden = true; h.events.get('visibilitychange')!()
    expect(h.views[1].destroy).toHaveBeenCalledTimes(1); expect(h.queue.size).toBe(0)
    h.context.ref.current.ownerDocument.hidden = false; h.events.get('visibilitychange')!(); await h.resolve()
    expect(h.views[2].pose).toEqual({ time: saved.time, open: saved.amount })
    const lost = { preventDefault: vi.fn() }; h.events.get('webglcontextlost')!(lost)
    expect(lost.preventDefault).toHaveBeenCalledTimes(1); expect(h.views[2].destroy).toHaveBeenCalledTimes(1)
    expect(h.host.watchView).toBeUndefined(); expect(h.pose).toEqual(saved)
  } finally { h.cleanup() }
})

it('hidden reduced watch defers snap until visible and root cleanup rejects late imports', async () => {
  const h = runtime(true, true)
  try {
    const progress = h.flow.state; h.flow.set(false, true)
    expect(h.flow.state).toEqual(progress); expect(h.pending).toHaveLength(0)
    h.context.ref.current.ownerDocument.hidden = false; h.events.get('visibilitychange')!()
    expect(h.flow.state).toEqual({ position: 0, velocity: 0 }); expect(h.pending).toHaveLength(0)
  } finally { h.cleanup() }
  const late = runtime(); late.cleanup(); await late.resolve()
  expect(late.views).toHaveLength(0)
})

it('production watch CTA and Back preserve browser-owned modifiers and route/history authority', () => {
  const h = harness(), c = h.context, n = navigation(h)
  const handlers = source.slice(source.indexOf('  function enter('), source.indexOf('  useLayoutEffect(()=>{\n    if(!ballMounted)'))
  const { enter, back } = run(`${handlers};return {enter,back}`, c)
  const event = (change: Record<string, any> = {}) => ({ button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    currentTarget: { ...h.watch.cta, getAttribute: (_name: string) => '/goal-loop', target: '', hasAttribute: () => false }, preventDefault: vi.fn(), ...change })
  try {
    c.sourceRef.current = null
    for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { defaultPrevented: true }]) {
      const e = event(change); enter(e); expect(e.preventDefault).not.toHaveBeenCalled(); expect(c.sourceRef.current).toBeNull()
    }
    const click = event(); enter(click)
    expect(c.pathname).toBe('/goal-loop'); expect(c.sourceRef.current).toBe(click.currentTarget); expect(click.preventDefault).toHaveBeenCalledOnce()
    const flow = c.flowRef.current; for (let i = 0; i < 12; i++) h.tick()
    const state = flow.state
    back(event({ metaKey: true })); expect(c.desiredRef.current).toBe(true)
    const exit = event(), keys = new Map<string, (e: any) => void>()
    c.back = back; c.watchBackRef.current = { click: () => back(exit), focus() {} }
    c.document.addEventListener = (key: string, fn: (e: any) => void) => keys.set(key, fn)
    c.document.removeEventListener = (key: string) => keys.delete(key)
    const escapeStart = source.indexOf('    const escape=event=>')
    const removeEscape = run(source.slice(escapeStart, source.indexOf('  },[])', escapeStart)), c)
    const escape = { key: 'Escape', defaultPrevented: false, preventDefault: vi.fn() }
    keys.get('keydown')!(escape); keys.get('keydown')!(escape); back(event())
    expect(escape.preventDefault).toHaveBeenCalledOnce(); removeEscape()
    expect(c.history.back).toHaveBeenCalledOnce(); expect(exit.preventDefault).toHaveBeenCalledOnce()
    h.commit(); expect(flow.state).toEqual(state)
    h.path('/'); h.tick(); h.tick(); const reverse = flow.state
    h.path('/goal-loop'); expect(flow.state).toEqual(reverse)
    c.location.hash = '#run-tape'
    c.onNavigate = vi.fn((e: ReturnType<typeof event>) => { e.preventDefault(); h.path('/') })
    back(event()); expect(c.onNavigate).toHaveBeenCalledOnce(); expect(c.history.back).toHaveBeenCalledOnce()
    h.settle(); expect(c.scrollY).toBe(13)
  } finally { n.cleanup(); h.cleanup() }
})

it.each(['load', 'pageshow'])('cold real watch fragment waits for paint after %s and cancels stale intent', event => {
  const h = harness(true), c = h.context, events = new Map<string, () => void>()
  const target = { scrollIntoView: vi.fn() }
  c.location.hash = '#run-tape'; c.document.readyState = 'loading'; c.document.getElementById = () => target
  c.addEventListener = (key: string, fn: () => void) => events.set(key, fn)
  c.removeEventListener = (key: string) => events.delete(key)
  const anchorStart = source.indexOf('  function scrollStoryAnchor()')
  c.scrollStoryAnchor = run(`${source.slice(anchorStart, source.indexOf('  useLayoutEffect', anchorStart))};return scrollStoryAnchor`, c)
  const start = source.indexOf("    if(pathname!=='/goal-loop')"), effect = source.slice(start, source.indexOf('  },[pathname])', start))
  const cleanup = run(effect, c)
  try {
    h.commit(); h.tick(); expect(target.scrollIntoView).toHaveBeenCalledOnce()
    c.document.readyState = 'complete'; events.get(event)!(); h.tick()
    expect(target.scrollIntoView).toHaveBeenCalledOnce()
    h.tick(); expect(target.scrollIntoView).toHaveBeenCalledTimes(2)
    expect(c.watchFragmentRef.current).toBe(false)
    cleanup(); c.watchFragmentRef.current = true
    const staleCleanup = run(effect, c)
    h.tick(); c.desiredRef.current = false; h.tick()
    expect(target.scrollIntoView).toHaveBeenCalledTimes(2); staleCleanup()
  } finally { cleanup(); h.cleanup() }
})
