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
const appStart = appSource.indexOf('    const anchor = navigationAnchor')
const appNavigation = appSource.slice(appStart, appSource.indexOf('\n  }, [])', appStart)).replace('querySelector<HTMLElement>', 'querySelector').replace(' as HTMLAnchorElement', '')
const run = (code: string, context: Record<string, any>) => new Function('context', `with(context){${code}}`)(context)
const ref = (current: any) => ({ current })
const focusStart = source.indexOf('    const pending=pendingFocusRef.current')
const focusEffect = source.slice(focusStart, source.indexOf('\n  })', focusStart))

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
    const cta = { hidden: false, closest: (): object | null => deck.inert ? deck : null, focus() { expect(this.hidden || deck.inert || deck.ariaHidden).toBe(false); focus.push(name) }, getBoundingClientRect: () => ({ top: 660, bottom: 700 }) }
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
  const button = (name: string) => ({ closest: (): object | null => deck.inert ? deck : null, focus() { expect(deck.inert || deck.ariaHidden).toBe(false); focus.push(name) } })
  const watchButton = button('watch-show'), ballButton = button('ball-show')
  const deck = { style: style(), inert: false, ariaHidden: false, removeAttribute() {}, closest: () => ({ querySelector: () => header }), querySelector: (q: string) => q === '.watch-view' ? watch.host : q === '.volleyball-view' ? ball.host : q === '.sheet-fan' ? fan : q === '.table-footer' ? footer : q === '[data-sheet="gameonvb"] .sheet-cta' ? ball.cta : q === '[data-sheet="goal-loop"] .sheet-cta' ? watch.cta : q.includes('GameOnVB') ? ballButton : watchButton }
  const context: Record<string, any> = {
    pathname: cold ? '/goal-loop' : '/', mounted: cold, desired: cold, ballMounted: false, ballDesired: false, reduced: false, position: 0,
    dialogRef: ref(dialog), flowRef: ref(null), restoreRef: ref(null), desiredRef: ref(cold), sourceRef: ref(watch.cta), watchColdRef: ref(cold), watchFragmentRef: ref(cold), watchBackRef: ref({ closest: () => null, focus() { expect(dialog.open && context.mounted).toBe(true); focus.push('watch-back') } }),
    ballDialogRef: ref(ballDialog), ballDesiredRef: ref(false), ballSourceRef: ref(ball.cta), ballRestoreRef: ref(null), coldRef: ref(false), backRef: ref({ closest: () => null, focus() { expect(ballDialog.open && context.ballMounted).toBe(true); focus.push('ball-back') } }),
    pendingFocusRef: ref(null), ballIndex: 1, watchIndex: 0, sheets: [{ id: 'gameonvb', label: 'GameOnVB' }, { id: 'goal-loop', label: 'Goal Loop' }],
    deckRef: ref(deck), assistRef: ref({ cancel() {} }), innerWidth: 1440, innerHeight: 1000, scrollY: cold ? 0 : 13,
    location: new URL(cold ? '/goal-loop' : '/', 'https://portfolio.test/'), history: { state: null, back: vi.fn() }, getRouteNavigationUrl, onNavigate: vi.fn(),
    document: { addEventListener() {}, removeEventListener() {}, hidden: false, visibilityState: 'visible', getElementById: () => null, body: { style: { overflow: 'scroll' } }, createElement: () => ({ style: style(), remove() {} }) },
    addEventListener() {}, removeEventListener() {},
    window: { matchMedia: () => ({ matches: false }), scrollTo({ top }: { top: number }) { context.scrollY = top } }, scrollStoryAnchor() {},
    DOMMatrix: class { a = .83; b = -.05; c = .05; d = .83; e = 0; f = 0 }, Event: class {}, ResizeObserver: class { observe() {} disconnect() {} },
    getComputedStyle: (o: any) => o === fan ? { width: '602px', height: '502px', left: '501px', top: '451px' } : o === ball.sheet.parentElement || o === watch.sheet.parentElement ? { width: '602px', height: '502px', transform: 'matrix', transformOrigin: '301px 251px' } : o === ball.band ? { top: '450px', height: '44px', paddingTop: '12px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' } : { width: '600', height: '500' },
    createWatchFlow, BALL_DURATION, createBallChoreography, captureBallOrientation, ballEase, ballEntryPresentation, ballContactLayout, staticLanding, staticStepImage, deckPosition,
    setPhase(v: string) { pending.phase = v }, setBallPhase(v: string) { pending.ballPhase = v }, setPosition(v: number) { pending.position = v },
  }
  let pending: Record<string, any> = {}
  for (const key of ['mounted', 'desired', 'ballMounted', 'ballDesired']) context[`set${key[0].toUpperCase() + key.slice(1)}`] = (v: boolean) => { pending[key] = v }
  ball.host.ballFlow = createBallFlow(s => { ball.host.ballEntry?.paint(s.time); return false }, p => ball.host.ballEntry?.land(p))
  const sync = source.slice(source.indexOf("    const want=pathname==='/gameonvb'"), source.indexOf('  },[pathname])'))
  const ballEffect = source.slice(source.indexOf('    if(!ballMounted)return'), source.indexOf('  },[ballMounted,ballDesired,reduced,position])'))
  const start = source.indexOf('    if(!mounted)return')
  const watchEffect = start < 0 ? '' : source.slice(start, source.indexOf('  },[mounted,desired,reduced])'))
  let ballDeps = '', watchDeps = ''
  function commitOnce() {
    Object.assign(context, pending); pending = {}
    ball.cta.hidden = Math.abs(context.position - 1) > .02; watch.cta.hidden = Math.abs(context.position) > .02
    deck.inert = Boolean(context.ballRestoreRef.current || context.restoreRef.current)
    deck.ariaHidden = context.ballMounted || context.mounted
    const render = Object.assign(Object.create(context), Object.fromEntries(['ballMounted', 'ballDesired', 'mounted', 'desired', 'reduced', 'position'].map(key => [key, context[key]])))
    const b = [context.ballMounted, context.ballDesired, context.reduced, context.position].join(), w = [context.mounted, context.desired, context.reduced].join()
    if (b !== ballDeps) { ballDeps = b; run(ballEffect, render) }
    if (w !== watchDeps) { watchDeps = w; run(watchEffect, render) }
    run(focusEffect, render)
  }
  function commit() {
    for (let i = 0; i < 10; i++) {
      commitOnce()
      if (!Object.keys(pending).length) return
    }
    throw new Error('commit did not settle')
  }
  function requestPath(pathname: string) { context.pathname = context.location.pathname = pathname; run(sync, context) }
  function path(pathname: string) { requestPath(pathname); commit() }
  function tick() { now += 16; const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn(now)); commit(); expect(maxOpen).toBeLessThanOrEqual(1); expect(context.document.body.style.overflow).toBe(dialog.open || ballDialog.open ? 'hidden' : 'scroll') }
  function settle() { for (let i = 0; i < 400; i++) tick() }
  function cleanup() { context.flowRef.current?.destroy(); ball.host.ballFlow.destroy(); context.restoreRef.current?.(); context.ballRestoreRef.current?.(); expect(queue.size).toBe(0); vi.unstubAllGlobals() }
  return { context, watch, ball, dialog, ballDialog, deck, fan, footer, view, focus, requestPath, path, tick, settle, commit, commitOnce, cleanup }
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
  Object.assign(c, { navigationAnchor: undefined, normalizePathname, pushRouteNavigation, isLightTablePair, selectHomeTransition,
    setUnknownPath() {}, setRoute(route: { path: string }) { h.path(route.path) },
  })
  const navigate = new Function('event', 'context', `with(context){${appNavigation}}`)
  c.onNavigate = vi.fn((e: any) => navigate(e, c))
  const handlers = source.slice(source.indexOf('  function enter('), source.indexOf('  useLayoutEffect(()=>{\n    if(!ballMounted)'))
  const { enter, back, ballBack } = run(`${handlers};return {enter,back,ballBack}`, c)
  const event = (href: string) => ({ button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    currentTarget: { ...(href === '/gameonvb' ? h.ball.cta : h.watch.cta), target: '', getAttribute: () => href, hasAttribute: () => false, closest: () => null }, preventDefault: vi.fn() })
  c.back = back; c.ballBack = ballBack
  c.watchBackRef.current = { ...c.watchBackRef.current, click: () => back(event('/')) }
  c.backRef.current = { ...c.backRef.current, click: () => ballBack(event('/')) }
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
    // Entry scroll may belong to the other project; return to this one's card.
    const projectScroll = incoming === '/goal-loop' ? 0 : 850
    c.onNavigate.mockClear()
    n.exit(incoming, escape); n.exit(incoming, escape)
    expect(c.onNavigate).toHaveBeenCalledOnce(); expect(c.onNavigate.mock.calls[0][0].currentTarget.getAttribute('href')).toBe('/')
    expect(c.history.back).not.toHaveBeenCalled(); expect(c.pathname).toBe('/')
    expect(flow.state).toEqual(before); expect(c.document.body.style.overflow).toBe('hidden')
    expect(host.surface.parentElement === host.host).toBe(host === h.watch)
    h.tick(); expect(host.surface.parentElement === host.host).toBe(host === h.watch)
    h.settle()
    expect(c.pathname).toBe('/'); expect(c.document.body.style.overflow).toBe('scroll')
    expect(flow.state).toEqual(incoming === '/goal-loop' ? { position: 0, velocity: 0 } : { time: 0, velocity: 0 })
    expect(c.scrollY).toBe(projectScroll)
    expect(c.position).toBe(incoming === '/goal-loop' ? 0 : 1)
    expect(h.focus.at(-1)).toBe(incoming === '/goal-loop' ? 'watch' : 'ball')
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
    expect(host.surface.parentElement === host.host).toBe(host === h.watch)
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
    expect(host.surface.parentElement === host.host).toBe(host === h.watch)
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
      c.scrollY = 0
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
    // Cold GameOnVB used to restore zero, which is the Goal Loop card.
    if (entry === 'cold') expect(c.scrollY).toBe(path === '/gameonvb' ? 850 : 0)
  } finally { n.cleanup(); h.cleanup() }
})

it('actual production kitchen entry fades without moving the watch and restores source styles/scroll/focus', () => {
  const h = harness()
  try {
    h.path('/goal-loop')
    expect(h.context.restoreRef.current).toBeTypeOf('function')
    expect(h.dialog.open).toBe(true); expect(h.watch.surface.parentElement).toBe(h.watch.host)
    expect(h.watch.surface.style.cssText).toBe('original inline style')
    expect(h.dialog.style['--progress' as keyof typeof h.dialog.style]).toBe('0')
    for (let i = 0; i < 12; i++) h.tick()
    const flow = h.context.flowRef.current, state = flow.state
    expect(Number(h.dialog.style['--progress' as keyof typeof h.dialog.style])).toBeGreaterThan(0)
    expect(Number(h.dialog.style['--progress' as keyof typeof h.dialog.style])).toBeLessThan(1)
    expect(h.watch.surface.parentElement).toBe(h.watch.host)
    expect(h.watch.host.watchEntry).toBeUndefined()
    h.path('/'); expect(flow.state).toEqual(state); h.tick(); h.tick()
    const reversing = flow.state; h.path('/goal-loop'); expect(flow.state).toEqual(reversing)
    expect(h.watch.host.watchView).toBe(h.view)
    expect(h.view.resize).not.toHaveBeenCalled()
    h.path('/'); h.settle()
    expect(h.view.paint).not.toHaveBeenCalled()
    expect(h.watch.surface.parentElement).toBe(h.watch.host)
    for (const node of [h.watch.surface, h.deck, h.fan, h.footer]) expect(node.style.cssText).toBe('original inline style')
    // Captured scroll 13 belonged to entry, not the Goal Loop card's endpoint.
    expect(h.context.scrollY).toBe(0); expect(h.focus.at(-1)).toBe('watch')
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
    expect(h.dialog.dataset).toMatchObject({ progress: '1.00000' })
    expect(h.watch.surface.parentElement).toBe(h.watch.host)
    h.path('/'); h.settle(); expect(h.context.scrollY).toBe(0); expect(h.context.position).toBe(0)
    expect(h.context.watchColdRef.current).toBe(false)
  } finally { h.cleanup() }
})

it.each([
  ['/goal-loop', 0], ['/goal-loop', 1], ['/goal-loop', 2],
  ['/gameonvb', 0], ['/gameonvb', .65], ['/gameonvb', 1], ['/gameonvb', 2],
] as const)('%s restores its own card and CTA after entry from deck position %s and document scrolling', (path, from) => {
  const h = harness(), c = h.context, ball = path === '/gameonvb'
  try {
    c.position = from; c.scrollY = from * 850
    h.path(path)
    expect(h.focus.at(-1)).toBe(ball ? 'ball-back' : 'watch-back')
    h.settle()
    c.scrollY = 2700; (ball ? h.ballDialog : h.dialog).scrollTop = 1600
    h.path('/'); h.settle()
    expect(c.position).toBe(ball ? 1 : 0); expect(c.scrollY).toBe(ball ? 850 : 0)
    expect(h.focus.at(-1)).toBe(ball ? 'ball' : 'watch')
    expect(c.pendingFocusRef.current).toBeNull()
  } finally { h.cleanup() }
})

it.each(['/goal-loop', '/gameonvb'])('%s reduced landing defers focus until closed content and card visibility commit', path => {
  const h = harness(), c = h.context, ball = path === '/gameonvb'
  try {
    c.reduced = true; h.path(path)
    c.position = 2; c.scrollY = 2600; c.innerHeight = 1200
    h.focus.length = 0
    h.requestPath('/'); h.commitOnce()
    expect(h.dialog.open || h.ballDialog.open).toBe(false)
    expect(h.focus).toEqual([]); expect(h.deck.ariaHidden).toBe(true)
    expect(c.scrollY).toBe(ball ? 1020 : 0)
    h.commit()
    expect(h.deck.ariaHidden || h.deck.inert).toBe(false)
    expect(h.focus).toEqual([ball ? 'ball' : 'watch'])
    expect(c.position).toBe(ball ? 1 : 0); expect(c.scrollY).toBe(ball ? 1020 : 0)
  } finally { h.cleanup() }
})

it.each(['/goal-loop', '/gameonvb'])('%s uses its own Show button when the committed CTA is hidden, clipped or inert', path => {
  const h = harness(), c = h.context, ball = path === '/gameonvb'
  try {
    c.reduced = true; h.path(path); h.path('/')
    const cta = ball ? h.ball.cta : h.watch.cta
    for (const unavailable of ['hidden', 'clipped', 'inert']) {
      cta.hidden = unavailable === 'hidden'
      cta.getBoundingClientRect = () => unavailable === 'clipped' ? { top: -50, bottom: -10 } : { top: 660, bottom: 700 }
      cta.closest = () => unavailable === 'inert' ? {} : null
      c.pendingFocusRef.current = { id: ball ? 'gameonvb' : 'goal-loop', entry: false }
      run(focusEffect, c)
      expect(h.focus.at(-1)).toBe(ball ? 'ball-show' : 'watch-show')
      expect(c.pendingFocusRef.current).toBeNull()
    }
  } finally { h.cleanup() }
})

it.each([
  ['/goal-loop', '/gameonvb'], ['/gameonvb', '/goal-loop'],
])('%s handoff to %s suppresses outgoing focus, including a queued homepage focus', (outgoing, incoming) => {
  const h = harness(), c = h.context
  try {
    c.reduced = true; h.path(outgoing)
    h.focus.length = 0; h.path(incoming)
    expect(h.focus).toEqual([incoming === '/gameonvb' ? 'ball-back' : 'watch-back'])
    h.focus.length = 0
    h.requestPath('/'); h.commitOnce()
    expect(c.pendingFocusRef.current?.entry).toBe(false); expect(h.focus).toEqual([])
    h.path(outgoing)
    expect(h.focus).toEqual([outgoing === '/gameonvb' ? 'ball-back' : 'watch-back'])
    expect(h.dialog.open).toBe(outgoing === '/goal-loop'); expect(h.ballDialog.open).toBe(outgoing === '/gameonvb')
  } finally { h.cleanup() }
})

it.each([
  ['/goal-loop', '/gameonvb'], ['/gameonvb', '/goal-loop'],
])('%s handoff to %s revalidates intent after outgoing restoration before incoming mounting', (outgoing, incoming) => {
  const h = harness(), c = h.context
  try {
    c.reduced = true; h.path(outgoing); h.focus.length = 0
    h.requestPath(incoming); h.commitOnce()
    expect(c.restoreRef.current).toBeNull(); expect(c.ballRestoreRef.current).toBeNull()
    expect(h.dialog.open || h.ballDialog.open).toBe(false); expect(h.focus).toEqual([])
    h.path(outgoing)
    expect(h.dialog.open).toBe(outgoing === '/goal-loop'); expect(h.ballDialog.open).toBe(outgoing === '/gameonvb')
    expect(h.focus).toEqual([outgoing === '/goal-loop' ? 'watch-back' : 'ball-back'])
    if (incoming === '/gameonvb') expect(h.ball.host.ballEntry).toBeUndefined()
    else expect(c.flowRef.current).toBeNull()
  } finally { h.cleanup() }
})

it('revalidates incoming GameOnVB after the outgoing watch restores but before source preparation commits', () => {
  const h = harness(), c = h.context
  try {
    c.reduced = true; h.path('/goal-loop'); h.focus.length = 0
    h.requestPath('/gameonvb'); h.commitOnce()
    expect(c.restoreRef.current).toBeNull(); expect(h.dialog.open).toBe(false)
    h.commitOnce()
    expect(c.ballMounted).toBe(true); expect(c.position).toBe(0)
    expect(h.ball.host.ballEntry).toBeUndefined(); expect(h.focus).toEqual([])
    h.path('/goal-loop')
    expect(c.ballMounted).toBe(false); expect(h.ball.host.ballEntry).toBeUndefined()
    expect(h.ball.surface.parentElement).toBe(h.ball.host); expect(h.watch.surface.parentElement).toBe(h.watch.host)
    expect(h.ballDialog.open).toBe(false); expect(h.dialog.open).toBe(true)
    expect(h.focus).toEqual(['watch-back'])
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
    c.back = back; c.watchBackRef.current = { ...c.watchBackRef.current, click: () => back(exit) }
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
    // Explicit Home navigation also returns to Goal Loop's endpoint, not entry 13.
    h.settle(); expect(c.scrollY).toBe(0)
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


it.each(['/goal-loop', '/gameonvb'])('%s mounted cold from the landing returns to its marked history entry', path => {
  const h = harness(), c = h.context, n = navigation(h)
  try {
    n.enter(path)
    // The route split mounts LightTable cold, even for an in-app landing click.
    c.watchColdRef.current = path === '/goal-loop'
    c.coldRef.current = path === '/gameonvb'
    c.history.back.mockClear()
    c.onNavigate.mockClear()
    n.exit(path, false)
    expect(c.history.state.lightTableFromHome).toBe(true)
    expect(c.history.back).toHaveBeenCalledOnce()
    expect(c.onNavigate).not.toHaveBeenCalled()
  } finally { n.cleanup(); h.cleanup() }
})


it('disables the actual homepage Watch runtime throughout the kitchen entry and resumes it on return', () => {
  const expression = source.match(/<Watch\b[^>]*\bactive=\{([^}]+)\}/)![1]
  for (const state of [
    { position: 0, mounted: false, restoreRef: ref(null), ballMounted: false, expected: true },
    { position: 0, mounted: true, restoreRef: ref(null), ballMounted: false, expected: false },
    { position: 0, mounted: true, restoreRef: ref(() => {}), ballMounted: false, expected: false },
    { position: 0, mounted: false, restoreRef: ref(() => {}), ballMounted: false, expected: false },
    { position: 0, mounted: false, restoreRef: ref(null), ballMounted: true, expected: false },
  ]) expect(run(`return (${expression})`, state)).toBe(state.expected)
  const start = source.indexOf('    if(!mounted)return')
  const effect = source.slice(start, source.indexOf('  },[mounted,desired,reduced])', start))
  expect(effect).not.toMatch(/watchSurface|entry-watch-slot|append\(|sourceAffine|DOMMatrix|watchEntry/)
})


it('pauses the independent kitchen fade while hidden, defers a reduced-motion snap, and removes its visibility listener', () => {
  const h = harness(), c = h.context, listeners = new Map<string, () => void>()
  c.document.addEventListener = vi.fn((name: string, listener: () => void) => listeners.set(name, listener))
  c.document.removeEventListener = vi.fn((name: string) => listeners.delete(name))
  try {
    c.document.hidden = true
    h.path('/goal-loop')
    const flow = c.flowRef.current
    expect(flow.state).toEqual({ position: 0, velocity: 0 })
    expect(flow.pending).toBe(false)
    c.reduced = true; h.commit()
    expect(flow.state.position).toBe(0)
    c.document.hidden = false; listeners.get('visibilitychange')!()
    h.commit()
    expect(flow.state).toEqual({ position: 1, velocity: 0 })
    expect(h.dialog.dataset).toMatchObject({ progress: '1.00000' })
    expect(c.phase).toBe('open')
    expect(h.watch.surface.parentElement).toBe(h.watch.host)
    h.path('/')
    expect(c.flowRef.current).toBeNull()
    expect(h.dialog.open).toBe(false)
    // Visibility changes must not revive the old entry-scroll return target.
    expect(c.scrollY).toBe(0)
    expect(listeners.has('visibilitychange')).toBe(false)
    expect(c.document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  } finally { h.cleanup() }
})
