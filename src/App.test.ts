import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import App, { applyRouteMetadata, beginNavigation, crossFadeProjects, focusHomeContact, installRevealMotion, isLightTablePair, isProjectSwitch, selectHomeTransition } from './App'
import { createWatchFlow } from './home/lightTable/watchFlow.js'
import { createDeckAssist } from './home/lightTable/deckAssist.js'
import { BALL_DURATION, createBallFlow } from './home/lightTable/ballFlow.js'
import { readFileSync } from 'node:fs'
import { getRouteNavigationUrl, normalizePathname, pushRouteNavigation, ROUTES, resolveRoute, routeMetadata } from './content/routes'

function render(path = '/') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

function createClassList() {
  const values = new Set<string>()
  return {
    add: (...tokens: string[]) => tokens.forEach((token) => values.add(token)),
    contains: (token: string) => values.has(token),
    remove: (...tokens: string[]) =>
      tokens.forEach((token) => values.delete(token)),
  }
}

describe('light-table homepage and project shells', () => {
  it('offers Contact beside the brand and retains the three project links and form CVs', () => {
    for (const path of ['/', '/gameonvb', '/goal-loop', '/playground']) {
      const html = render(path)
      const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'))
      expect(header).toMatch(/class="target-link header-contact" href="\/#contact">Contact<\/a>/)
      for (const href of ['/gameonvb', '/goal-loop', '/playground']) expect(header).toContain(`href="${href}"`)
      expect(header).not.toMatch(/cv-|>CV/)
    }
  })

  it('renders the approved fan and all source-safe supporting sections in order', () => {
    const markup = render()
    expect(markup).toContain('New tools.')
    expect(markup).toContain('Old standards.')
    expect([...markup.matchAll(/data-poster="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'hero', 'gameonvb', 'solidpixels', 'goal-loop', 'playground', 'tools', 'contact',
    ])
    expect([...markup.matchAll(/data-sheet="([^"]+)"/g)].map(m => m[1])).toEqual(['goal-loop', 'gameonvb', 'intro'])
    expect(markup).toContain('data-light-table-shell="true"')
    expect(markup).not.toMatch(/poster-track|poster-canvas-host/)
    expect(markup).toContain('>Homepage</a>')
  })

  it('links approved projects and keeps SolidPixels and Small tools non-link', () => {
    const markup = render()
    expect(markup).toContain('href="/gameonvb"')
    expect(markup).toContain('href="/goal-loop"')
    expect(markup).toContain('href="/playground"')
    const solid = markup.slice(markup.indexOf('data-poster="solidpixels"'), markup.indexOf('data-poster="goal-loop"'))
    expect(solid).not.toContain('<a ')
    const tools = markup.slice(markup.indexOf('data-poster="tools"'), markup.indexOf('id="contact"'))
    expect(tools).toContain('Screen Switch, a native macOS menu-bar utility that exchanges windows between displays.')
    expect(tools).not.toContain('<a ')
  })

  it('preserves contacts, both native CV downloads, landmarks, and link targets', () => {
    const markup = render()
    const firstAnchor = markup.match(/<a[^>]+href="([^"]+)"/)?.[1]

    expect(firstAnchor).toBe('#main-content')
    expect(markup).toContain('id="main-content"')
    for (const path of ROUTES.map(({ path }) => path)) {
      const routeMarkup = render(path)
      for (const fragment of routeMarkup.matchAll(/href="#([^"]+)"/g)) {
        expect(routeMarkup).toContain(`id="${fragment[1]}"`)
      }
      for (const anchor of routeMarkup.matchAll(/<a\s+([^>]+)>/g)) {
        expect(anchor[1]).toMatch(/class="[^"]*\btarget-link\b/)
      }
    }
    expect(markup).toContain('<header')
    expect(markup).toContain('<main')
    expect(markup).toContain('<footer')
    expect(markup).toContain('<nav aria-label="Primary"')
    expect(markup).toContain('<nav aria-label="Contact and CV"')
    expect(markup).toContain('href="mailto:tohoangviet1998@gmail.com"')
    const contact = markup.slice(markup.indexOf('id="contact"'))
    expect(contact).not.toContain('class="target-link poster-email"')
    expect(contact).not.toContain('>Copy</button>')
    expect(contact).not.toContain('aria-hidden="true">tohoangviet1998@gmail.com')
    expect(markup).toContain('href="https://github.com/toho36"')
    expect(markup).toContain(
      'href="https://www.linkedin.com/in/hoangvietto/"',
    )
    expect(markup).toMatch(
      /<a(?=[^>]*href="\/hoang-viet-to-cv-en\.docx")(?=[^>]*download="")[^>]*>/,
    )
    expect(markup).toMatch(
      /<a(?=[^>]*href="\/hoang-viet-to-cv-cz\.docx")(?=[^>]*download="")[^>]*>/,
    )
  })

  it('renders all four routes distinctly and gives unknown paths a 404', () => {
    const gameOnVB = render('/gameonvb/')
    const goalLoop = render('/goal-loop')
    const playground = render('/playground')
    const playgroundSlash = render('/playground/')
    const unknown = render('/not-a-route')

    expect(gameOnVB).toContain(
      'Sign-ups, payments and check-in for regular recreational volleyball sessions.',
    )
    expect(gameOnVB).toContain('href="/"')
    expect(gameOnVB).toContain('href="/goal-loop"')
    expect(goalLoop).toContain('id="goal-loop-title"')
    expect(goalLoop).toContain('id="kitchen-pass"')
    expect(goalLoop).toContain('href="/"')
    expect(goalLoop).toContain('href="/gameonvb"')
    for (const markup of [playground, playgroundSlash]) {
      expect(markup).toContain('data-wire-stage')
      expect(markup).not.toContain('id="goal-loop-title"')
      expect(markup).not.toContain('id="run-tape"')
    }
    expect(unknown).toContain("This page doesn&#x27;t exist.")
  })

  it('keeps every route destination and current-page link truthful', () => {
    for (const route of ROUTES) {
      const markup = render(route.path)
      const currentPath = resolveRoute(route.path).path

      for (const destination of ROUTES) {
        expect(markup).toContain(`href="${destination.path}"`)
      }

      const currentAnchors = [...markup.matchAll(/<a\s+([^>]+)>/g)].filter(
        ([, attributes]) => attributes.includes('aria-current="page"'),
      )
      const currentOccurrences = markup.match(/aria-current="page"/g) ?? []

      expect(currentOccurrences).toHaveLength(currentAnchors.length)
      expect(currentAnchors).toHaveLength(currentPath === '/' ? 2 : 1)
      for (const [, attributes] of currentAnchors) {
        expect(attributes).toContain(`href="${currentPath}"`)
      }

      if (currentPath === '/') {
        expect(markup).toMatch(
          /<a(?=[^>]*class="[^"]*\bbrand\b)(?=[^>]*href="\/")(?=[^>]*aria-current="page")[^>]*>/,
        )
      }
    }
  })

  it('applies title, description, canonical and og:url for every route', () => {
    for (const route of ROUTES) {
      const attributes = new Map<string, string>()
      const nodes = new Map<
        string,
        { setAttribute: (name: string, value: string) => void }
      >(
        [
          'meta[name="description"]',
          'link[rel="canonical"]',
          'meta[property="og:url"]',
        ].map((selector) => [
          selector,
          {
            setAttribute: (name: string, value: string) =>
              attributes.set(`${selector}:${name}`, value),
          },
        ] as [
          string,
          { setAttribute: (name: string, value: string) => void },
        ]),
      )
      const fakeDocument = {
        title: '',
        querySelector: (selector: string) => nodes.get(selector) ?? null,
      } as unknown as Document
      const expected = routeMetadata(route)

      applyRouteMetadata(fakeDocument, route)

      expect(fakeDocument.title).toBe(expected.title)
      expect(attributes.get('meta[name="description"]:content')).toBe(
        expected.description,
      )
      expect(attributes.get('link[rel="canonical"]:href')).toBe(
        expected.canonical,
      )
      expect(attributes.get('meta[property="og:url"]:content')).toBe(
        expected.canonical,
      )
    }
  })

  it('removes the machine, loop, and modal runtime paths instead of hiding them', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

    expect(source).not.toMatch(
      /['"]\.\/(?:machine|loops)\/|ProjectDetailDialog|showModal/,
    )
  })

  it('keeps shared-element navigation and a curtain fallback', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    expect(source).toContain('document.startViewTransition')
    expect(selectHomeTransition(true, false, true, false)).toBe('curtain')
    expect(selectHomeTransition(true, false, true, true)).toBe('shared')
    expect(selectHomeTransition(true, true, true, false)).toBe('plain')
    expect(selectHomeTransition(true, false, false, false)).toBe('plain')
    expect(source).toContain("dataset.curtain = 'reveal'")
  })
})

describe('reveal enhancement', () => {
  it('fails open when IntersectionObserver is unavailable or throws', () => {
    const rootClasses = createClassList()
    const revealClasses = createClassList()
    const root = { classList: rootClasses } as unknown as HTMLElement
    const reveal = { classList: revealClasses } as unknown as HTMLElement

    installRevealMotion(root, [reveal], undefined)
    expect(rootClasses.contains('motion-ready')).toBe(false)

    class ThrowingObserver {
      constructor() {
        throw new Error('observer unavailable')
      }
    }

    installRevealMotion(
      root,
      [reveal],
      ThrowingObserver as unknown as typeof IntersectionObserver,
    )
    expect(rootClasses.contains('motion-ready')).toBe(false)
    expect(revealClasses.contains('is-settled')).toBe(false)
  })

  it('removes observer and motion state during StrictMode-style cleanup', () => {
    const rootClasses = createClassList()
    const revealClasses = createClassList()
    const root = { classList: rootClasses } as unknown as HTMLElement
    const reveal = { classList: revealClasses } as unknown as HTMLElement
    let disconnected = false

    class WorkingObserver {
      observe() {}
      unobserve() {}
      disconnect() {
        disconnected = true
      }
    }

    const cleanup = installRevealMotion(
      root,
      [reveal],
      WorkingObserver as unknown as typeof IntersectionObserver,
    )
    expect(rootClasses.contains('motion-ready')).toBe(true)

    cleanup()
    expect(disconnected).toBe(true)
    expect(rootClasses.contains('motion-ready')).toBe(false)
    expect(revealClasses.contains('is-settled')).toBe(false)
  })
})

// Execute App's real click/navigation body; only its querySelector type argument is erased.
function provenanceNavigation(path = '/', state: Record<string, unknown> | null = null, newEntryKeys = {}) {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const start = source.indexOf('    const anchor = navigationAnchor')
  const code = source.slice(start, source.indexOf('\n  }, [])', start)).replace('querySelector<HTMLElement>', 'querySelector').replace(' as HTMLAnchorElement', '')
  const location = new URL(path, 'https://portfolio.test/')
  const entries = [{ url: location.href, state }]
  let index = 0
  const history = {
    get state() { return entries[index].state },
    pushState: vi.fn((state: Record<string, unknown> | null, _unused: string, path: string) => {
      entries.splice(++index)
      location.href = new URL(path, location.href).href
      entries[index] = { url: location.href, state: Object.keys(newEntryKeys).length ? { ...state, ...newEntryKeys } : state }
    }),
    replaceState: vi.fn((state: Record<string, unknown>, _unused: string, url: string) => { entries[index] = { url, state } }),
  }
  const anchorForDelegation = { getAttribute: () => '/gameonvb', target: '', hasAttribute: () => false, closest: () => null }
  const context = { navigationAnchor: undefined as typeof anchorForDelegation | undefined, window: { location, history, matchMedia: () => ({ matches: false }), scrollTo() {} },
    document: { visibilityState: 'visible', getElementById: () => null },
    getRouteNavigationUrl, normalizePathname, pushRouteNavigation, isLightTablePair, isProjectSwitch, crossFadeProjects, beginNavigation, selectHomeTransition,
    setUnknownPath() {}, setRoute: vi.fn(),
  }
  const navigate = new Function('event', 'context', `with(context){${code}}`)
  return { entries, history, location, click(href: string, change = {}, delegated = false) {
    const event = { button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      currentTarget: { getAttribute: () => href, target: '', hasAttribute: () => false, closest: () => null }, preventDefault: vi.fn(), ...change }
    if (delegated) {
      context.navigationAnchor = { ...anchorForDelegation, getAttribute: () => href }
      event.currentTarget.getAttribute = () => ''
    }
    navigate(event, context)
    return event
  } }
}

describe('App per-entry light-table provenance', () => {
  it.each(['/goal-loop', '/gameonvb'])('stamps a new animated Home -> %s entry, preserving new-entry keys', path => {
    const n = provenanceNavigation('/', { homeKey: 'home' }, { entryKey: 'preserved' })
    n.click(path)
    expect(n.location.pathname).toBe(path)
    expect(n.history.state).toEqual({ entryKey: 'preserved', lightTableFromHome: true })
    expect(n.entries[0].state).toEqual({ homeKey: 'home' })
    expect(n.history.replaceState).toHaveBeenCalledExactlyOnceWith(n.history.state, '', n.location.href)
  })

  it.each(['/goal-loop', '/gameonvb'])('keeps cold and sibling %s entries unmarked and same-route state unchanged', path => {
    const cold = provenanceNavigation(path, { entryKey: 'cold' })
    cold.click(path)
    expect(cold.history.state).toEqual({ entryKey: 'cold' })
    expect(cold.history.pushState).not.toHaveBeenCalled(); expect(cold.history.replaceState).not.toHaveBeenCalled()
    const n = provenanceNavigation()
    n.click(path); const state = n.history.state
    n.click(path)
    expect(n.history.state).toBe(state); expect(n.history.pushState).toHaveBeenCalledOnce(); expect(n.history.replaceState).toHaveBeenCalledOnce()
    const sibling = path === '/goal-loop' ? '/gameonvb' : '/goal-loop'
    n.click(sibling)
    expect(n.location.pathname).toBe(sibling); expect(n.history.state).toBeNull()
    expect(n.history.replaceState).toHaveBeenCalledOnce()
    n.click('/')
    expect(n.location.pathname).toBe('/'); expect(n.history.state).toBeNull()
    expect(n.history.replaceState).toHaveBeenCalledOnce()
  })

  it('leaves modified clicks and same-document fragments unstamped and browser-owned', () => {
    for (const href of ['/goal-loop', '/gameonvb']) {
      for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { defaultPrevented: true }, { currentTarget: { getAttribute: () => href, target: '_blank', hasAttribute: () => false } }, { currentTarget: { getAttribute: () => href, target: '', hasAttribute: () => true } }]) {
        const n = provenanceNavigation(), event = n.click(href, change)
        expect(event.preventDefault).not.toHaveBeenCalled()
        expect(n.history.pushState).not.toHaveBeenCalled(); expect(n.history.replaceState).not.toHaveBeenCalled()
      }
      const n = provenanceNavigation(href), event = n.click(`${href}#story`)
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(n.history.pushState).not.toHaveBeenCalled(); expect(n.history.replaceState).not.toHaveBeenCalled()
    }
  })
})


describe('light-table route integration', () => {
  it.each(['/gameonvb', '/goal-loop'])('hides the global navbar in %s and retains the project return link', path => {
    const html = render(path)
    expect(html).toMatch(/<header class="site-header" hidden=""/)
    expect(html).toContain('Back to homepage')
    for (const other of ['/', '/playground', '/not-a-route']) expect(render(other)).not.toMatch(/<header class="site-header" hidden=/)
    const css = readFileSync(new URL('./home/lightTable/lightTable.css', import.meta.url), 'utf8')
    expect(css).toContain('.site-header[hidden]')
    // Hidden while a project is open; the site header returns as soon as GameOnVB starts leaving.
    expect(css).toContain(":has(.ball-entry[open]:not([data-phase='leaving']), .goal-entry[open])")
  })
  it.each(['/gameonvb', '/goal-loop'])('leaves navbar entry to %s native instead of flying an inactive card', path => {
    const n = provenanceNavigation()
    const event = n.click(path, { currentTarget: { getAttribute: () => path, target: '', hasAttribute: () => false, closest: (selector: string) => selector === '.site-header' ? {} : null } })
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(n.history.pushState).not.toHaveBeenCalled()
    expect(n.history.replaceState).not.toHaveBeenCalled()
    const card = provenanceNavigation()
    expect(card.click(path).preventDefault).toHaveBeenCalledOnce()
    expect(card.location.pathname).toBe(path)
  })
  it('mounts the original cards on home, with one shell and no open project', () => {
    const html = render('/')
    expect(html.match(/<header[ >]/g)).toHaveLength(1)
    expect(html.match(/<main[ >]/g)).toHaveLength(1)
    expect(html.match(/<footer[ >]/g)).toHaveLength(1)
    expect(html).toContain('data-light-table-shell="true"')
    expect([...html.matchAll(/data-sheet="([^"]+)"/g)].map(m => m[1])).toEqual(['goal-loop', 'gameonvb', 'intro'])
    expect(html).toContain('Scroll or swipe to deal.')
    for (const id of ['introduction', 'contact']) expect(html).toContain(`id="${id}"`)
    expect(html).not.toMatch(/landing-composition|landing-page|landing-header|landing-footer|landing-nav-hint|data-p1-status|data-work-select|<dialog[^>]* open=/)
  })
  it.each(['/gameonvb', '/goal-loop'])('retains the cold project dialog on %s', path => {
    const html = render(path)
    expect(html).toContain('data-light-table-shell="true"')
    const dialogClass = path === '/gameonvb' ? 'ball-entry' : 'goal-entry'
    expect(html).toContain(`<dialog class="${dialogClass}" open=""`)
    expect(html).not.toContain('landing-composition')
  })
  it('leaves homepage fragments native and keeps home and projects in the same live Light Table', () => {
    for (const href of ['#introduction', '#contact']) {
      const n = provenanceNavigation()
      expect(n.click(href).preventDefault).not.toHaveBeenCalled()
      expect(n.history.pushState).not.toHaveBeenCalled()
    }
    expect(isLightTablePair('/', '/gameonvb')).toBe(true)
    expect(isLightTablePair('/goal-loop', '/')).toBe(true)
    expect(isLightTablePair('/goal-loop', '/gameonvb')).toBe(true)
  })
})

describe('project to project switch', () => {
  it('a newer navigation supersedes every earlier ticket', () => {
    const first = beginNavigation(), second = beginNavigation()
    expect(first()).toBe(false); expect(second()).toBe(true)
  })
  it('Forward during a pending Back cross-fade keeps the newer route', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    const start = source.indexOf('    return subscribeToRouteChanges(window, (next) => {')
    const effect = source.slice(start, source.indexOf('\n  }, [])', start))
    const pending: (() => void)[] = [], location = { pathname: '/gameonvb' }
    let listener: (next: { path: string }) => void = () => {}
    const context = { window: { location }, document: {}, ROUTES: [{ path: '/gameonvb' }, { path: '/goal-loop' }], shownPath: { current: '/gameonvb' },
      normalizePathname, isProjectSwitch, beginNavigation, setUnknownPath: vi.fn(), setRoute: vi.fn(),
      subscribeToRouteChanges: (_: unknown, fn: typeof listener) => { listener = fn; return () => {} },
      crossFadeProjects: (update: () => void) => { pending.push(update) } }
    new Function('context', `with(context){${effect}}`)(context)
    location.pathname = '/goal-loop'; listener({ path: '/goal-loop' })   // Back: deferred cross-fade
    location.pathname = '/gameonvb'; listener({ path: '/gameonvb' })     // Forward: same page, instant
    expect(context.setRoute).toHaveBeenLastCalledWith({ path: '/gameonvb' })
    pending.forEach(update => update())                                  // the stale Back callback runs late
    expect(context.setRoute).toHaveBeenCalledTimes(1)
    expect(context.setRoute).toHaveBeenLastCalledWith({ path: '/gameonvb' })
  })
  it('only the two case studies switch directly', () => {
    expect(isProjectSwitch('/gameonvb', '/goal-loop')).toBe(true)
    expect(isProjectSwitch('/goal-loop/', '/gameonvb')).toBe(true)
    for (const [from, to] of [['/', '/goal-loop'], ['/gameonvb', '/'], ['/gameonvb', '/gameonvb'], ['/goal-loop', '/playground']]) expect(isProjectSwitch(from, to)).toBe(false)
  })
  it('cross-fades with a view transition and falls back to an instant swap', async () => {
    const fake = (reduced: boolean, visible = 'visible', transitions = true) => {
      const root = { dataset: {} as Record<string, string> }, done: Promise<void>[] = []
      const doc = { documentElement: root, visibilityState: visible, defaultView: { matchMedia: () => ({ matches: reduced }) },
        startViewTransition: transitions ? (cb: () => void) => { const p = Promise.resolve(cb()); done.push(p); return { finished: p } } : undefined }
      return { doc: doc as unknown as Document, root, done }
    }
    // A frame wait inside the update callback would freeze a real transition, so no frame ever runs here.
    vi.stubGlobal('requestAnimationFrame', () => { throw new Error('the swap must not wait for a frame') })
    try {
      const motion = fake(false), update = vi.fn(() => expect(motion.root.dataset.projectSwitch).toBe('true'))
      crossFadeProjects(update, motion.doc)
      expect(update).toHaveBeenCalledTimes(1)
      await Promise.all(motion.done); await Promise.resolve()
      expect(motion.root.dataset.projectSwitch).toBeUndefined()
      // An interrupted switch that finishes after its successor started keeps the newer scope.
      let finishFirst = () => {}, finishSecond = () => {}
      const overlap = { dataset: {} as Record<string, string> }
      const deferred = (finish: (r: () => void) => void) => ({ documentElement: overlap, visibilityState: 'visible', defaultView: { matchMedia: () => ({ matches: false }) },
        startViewTransition: (cb: () => void) => { cb(); return { finished: new Promise<void>(resolve => finish(resolve)) } } }) as unknown as Document
      crossFadeProjects(() => {}, deferred(r => { finishFirst = r }))
      crossFadeProjects(() => {}, deferred(r => { finishSecond = r }))
      finishFirst(); await Promise.resolve(); await Promise.resolve()
      expect(overlap.dataset.projectSwitch).toBe('true')
      finishSecond(); await Promise.resolve(); await Promise.resolve()
      expect(overlap.dataset.projectSwitch).toBeUndefined()
      for (const still of [fake(true), fake(false, 'hidden'), fake(false, 'visible', false)]) {
        const instant = vi.fn(); crossFadeProjects(instant, still.doc)
        expect(instant).toHaveBeenCalledTimes(1); expect(still.root.dataset.projectSwitch).toBeUndefined(); expect(still.done).toHaveLength(0)
      }
    } finally { vi.unstubAllGlobals() }
  })
})



it.each(['/gameonvb', '/goal-loop', '/playground'])('uses the explicit anchor for delegated navigation to %s', path => {
  const n = provenanceNavigation()
  const event = n.click(path, {}, true)
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(n.location.pathname).toBe(path)
  expect(n.history.pushState).toHaveBeenCalledOnce()
  const modified = provenanceNavigation()
  expect(modified.click(path, { metaKey: true }, true).preventDefault).not.toHaveBeenCalled()
  expect(modified.history.pushState).not.toHaveBeenCalled()
})

describe('contact navigation', () => {
  it.each(['changed hash', 'same hash'])('cancels a settling deck before restoring contact with $0', activation => {
    const source = readFileSync(new URL('./home/lightTable/LightTable.jsx', import.meta.url), 'utf8')
    const start = source.indexOf('    const escape=event=>')
    const effect = source.slice(start, source.indexOf('\n  },[])', start))
    const frames = new Map<number, FrameRequestCallback>(), listeners = new Map<string, (event?: any) => void>()
    let id = 0
    const events = { addEventListener: (key: string, fn: () => void) => listeners.set(key, fn), removeEventListener: (key: string) => listeners.delete(key) }
    const contact = { closest: () => null, style: {}, focus: vi.fn(), scrollIntoView: () => vi.stubGlobal('scrollY', 5000) }
    const doc = { ...events, hidden: false, getElementById: () => contact, querySelector: () => null, dispatchEvent: vi.fn() }
    vi.stubGlobal('document', doc); vi.stubGlobal('scrollY', 0); vi.stubGlobal('innerHeight', 844)
    vi.stubGlobal('addEventListener', events.addEventListener); vi.stubGlobal('removeEventListener', events.removeEventListener)
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id })
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
    vi.stubGlobal('window', { scrollTo: ({ top }: { top: number }) => vi.stubGlobal('scrollY', top) })
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const assist = createDeckAssist({ dataset: {} } as HTMLElement, () => false)
    const context = { ...events, document: doc, location: new URL('https://portfolio.test/#contact'), getRouteNavigationUrl,
      assistRef: { current: assist }, ballDesiredRef: { current: false }, desiredRef: { current: false }, scrollStoryAnchor: vi.fn() }
    const cleanup = new Function('context', `with(context){${effect}}`)(context)
    const tick = (time: number) => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(time)) }
    try {
      const cancel = vi.spyOn(assist, 'cancel')
      for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { defaultPrevented: true },
        { target: { closest: () => ({ target: '_blank', hasAttribute: () => false }) } }]) {
        listeners.get('click')!({ target: { closest: () => ({ target: '', hasAttribute: () => false }) }, button: 0, ...change })
      }
      expect(cancel).not.toHaveBeenCalled(); expect(doc.dispatchEvent).not.toHaveBeenCalled()
      assist.move(1); tick(16)
      expect(scrollY).toBeGreaterThan(0)
      if (activation === 'changed hash') listeners.get('hashchange')!()
      else listeners.get('click')?.({ target: { closest: () => ({ target: '', hasAttribute: () => false }) }, button: 0 })
      focusHomeContact(doc as unknown as Document)
      expect(scrollY).toBe(5000)
      tick(32); tick(700)
      expect(scrollY).toBe(5000)
      expect(context.scrollStoryAnchor).not.toHaveBeenCalled()
      if (activation === 'same hash') expect(doc.dispatchEvent.mock.calls[0][0].type).toBe('homecontactready')
      cleanup(); expect(listeners.has('hashchange')).toBe(false); expect(listeners.has('click')).toBe(false)
    } finally { cleanup(); assist.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals() }
  })

  it.each(['/gameonvb', '/gameonvb/', '/goal-loop', '/goal-loop/'])('routes a plain %s contact exit through home without using history.back', path => {
    const n = provenanceNavigation(path, { lightTableFromHome: true })
    expect(n.click('/#contact').preventDefault).toHaveBeenCalledOnce()
    expect(n.location.pathname + n.location.hash).toBe('/#contact')
    expect(n.history.pushState).toHaveBeenCalledExactlyOnceWith(null, '', '/#contact')
    expect(n.history.replaceState).not.toHaveBeenCalled()
  })

  it('preserves native contact navigation on home/playground and all browser-owned clicks', () => {
    for (const path of ['/', '/playground']) {
      const n = provenanceNavigation(path)
      expect(n.click('/#contact').preventDefault).not.toHaveBeenCalled()
      expect(n.history.pushState).not.toHaveBeenCalled()
    }
    for (const path of ['/gameonvb', '/goal-loop']) {
      for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { defaultPrevented: true },
        { currentTarget: { getAttribute: () => '/#contact', target: '_blank', hasAttribute: () => false } },
        { currentTarget: { getAttribute: () => '/#contact', target: '', hasAttribute: () => true } }]) {
        const n = provenanceNavigation(path)
        expect(n.click('/#contact', change).preventDefault).not.toHaveBeenCalled()
        expect(n.history.pushState).not.toHaveBeenCalled()
      }
    }
  })

  it('opens cold /#contact without the arena, while ordinary fresh home retains it', () => {
    try {
      vi.stubGlobal('window', { location: new URL('https://portfolio.test/#contact') })
      const html = render('/')
      expect(html).not.toContain('arena-intro')
      expect(html).not.toMatch(/<main[^>]*inert/)
      expect(html.match(/<form /g)).toHaveLength(1)
      vi.stubGlobal('window', { location: new URL('https://portfolio.test/') })
      expect(render('/')).toContain('arena-intro')
    } finally { vi.unstubAllGlobals() }
  })

  it('focuses and scrolls contact below the measured header only when home is usable', () => {
    let inert = true, open = true
    const contact = { closest: () => inert ? {} : null, style: { scrollMarginTop: '' }, tabIndex: 0, focus: vi.fn(), scrollIntoView: vi.fn() }
    const doc = { getElementById: () => contact, querySelector: (selector: string) => selector === '.site-header' ? { getBoundingClientRect: () => ({ height: 126.5 }) } : open ? {} : null } as unknown as Document
    focusHomeContact(doc)
    inert = false; focusHomeContact(doc)
    expect(contact.focus).not.toHaveBeenCalled(); expect(contact.scrollIntoView).not.toHaveBeenCalled()
    open = false; focusHomeContact(doc)
    expect(contact.tabIndex).toBe(-1)
    expect(contact.style.scrollMarginTop).toBe('143px')
    expect(contact.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
    expect(contact.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'instant', block: 'start' })
  })

  it('wires native fragment/load restoration and the post-dialog signal, and removes pending work on unmount', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
    const start = source.indexOf('    let frame = 0')
    const effect = source.slice(start, source.indexOf('\n  }, [closeIntro])', start))
    const listeners = new Map<string, () => void>(), frames = new Map<number, FrameRequestCallback>()
    let id = 0, inert = true
    const target = { closest: () => inert ? {} : null, style: {}, focus: vi.fn(), scrollIntoView: vi.fn() }
    const main = { get inert() { return inert } }
    const events = { addEventListener: (key: string, fn: () => void) => listeners.set(key, fn), removeEventListener: (key: string) => listeners.delete(key) }
    const doc = { ...events, readyState: 'loading', getElementById: (key: string) => key === 'main-content' ? main : target, querySelector: () => null }
    const location = new URL('https://portfolio.test/#contact')
    const context = { window: { ...events, location }, document: doc, focusHomeContact,
      closeIntro: vi.fn(() => { inert = false }),
      requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(++id, fn); return id }, cancelAnimationFrame: (key: number) => frames.delete(key),
    }
    const cleanup = new Function('context', `with(context){${effect}}`)(context)
    const tick = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(0)) }
    expect(target.focus).not.toHaveBeenCalled()
    listeners.get('load')!(); tick()
    expect(target.focus).not.toHaveBeenCalled()
    tick()
    expect(context.closeIntro).toHaveBeenCalledOnce(); expect(target.focus).toHaveBeenCalledOnce()
    listeners.get('homecontactready')!()
    expect(context.closeIntro).toHaveBeenCalledOnce(); expect(target.focus).toHaveBeenCalledTimes(2)
    location.hash = '#introduction'; listeners.get('hashchange')!()
    expect(target.focus).toHaveBeenCalledTimes(2)
    location.hash = '#contact'; listeners.get('hashchange')!()
    expect(target.focus).toHaveBeenCalledTimes(3)
    listeners.get('pageshow')!(); cleanup()
    expect(listeners.size).toBe(0); expect(frames.size).toBe(0)
  })

  it.each(['/gameonvb', '/goal-loop'].flatMap(path => [false, true].map(reduced => ({ path, reduced }))))('delivers $path contact focus after flow landing and home commit (reduced=$reduced)', ({ path, reduced }) => {
    const source = readFileSync(new URL('./home/lightTable/LightTable.jsx', import.meta.url), 'utf8')
    const ball = path === '/gameonvb'
    const handlers = source.slice(source.indexOf('  function back(event)'), source.indexOf('  useLayoutEffect(()=>{\n    if(!ballMounted)'))
    const landStart = ball ? source.indexOf('      function land(p){') : source.lastIndexOf('      function land(p){')
    const landEnd = source.indexOf(ball ? '\n      host.captureBallPreview' : '\n      paint(watchColdRef', landStart)
    const focusStart = source.indexOf('    const pending=pendingFocusRef.current')
    const focus = source.slice(focusStart, source.indexOf('\n  })', focusStart))
    const run = (code: string, context: Record<string, any>) => new Function('context', `with(context){${code}}`)(context)
    const frames = new Map<number, FrameRequestCallback>(); let id = 0, time = 0
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id })
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
    const ref = (current: any) => ({ current })
    const contact = { style: {}, closest: () => homeInert ? {} : null, focus: vi.fn(), scrollIntoView: vi.fn() }
    let open = true, homeInert = true
    const doc = { getElementById: () => contact, querySelector: (selector: string) => selector === '.site-header' ? { getBoundingClientRect: () => ({ height: 128 }) } : open ? {} : null,
      dispatchEvent: vi.fn((event: Event) => { expect(event.type).toBe('homecontactready'); expect(open || homeInert).toBe(false); focusHomeContact(doc as unknown as Document) }) }
    const c: Record<string, any> = { location: new URL(path, 'https://portfolio.test/'), history: { state: { lightTableFromHome: true }, back: vi.fn() }, getRouteNavigationUrl,
      desiredRef: ref(!ball), ballDesiredRef: ref(ball), restoreRef: ref(ball ? null : {}), ballRestoreRef: ref(ball ? {} : null), pendingFocusRef: ref(null),
      mounted: !ball, ballMounted: ball, coldRef: ref(false), watchColdRef: ref(false), flowRef: ref(null), document: doc, Event,
      ballIndex: 1, watchIndex: 0, innerHeight: 844, window: { scrollTo: vi.fn() }, setPosition: vi.fn(), setBallPhase: vi.fn(), setPhase: vi.fn(),
      setDesired: vi.fn(), setBallDesired: vi.fn(), setMounted: vi.fn(), setBallMounted: vi.fn(),
      restore() { open = false; c.restoreRef.current = null; c.ballRestoreRef.current = null },
      onNavigate: vi.fn((event) => { event.preventDefault(); c.location.href = 'https://portfolio.test/#contact' }),
    }
    const event = (change = {}) => ({ currentTarget: { getAttribute: () => '/#contact', target: '' }, button: 0, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn(), ...change })
    const exit = run(`${handlers};return ${ball ? 'ballBack' : 'back'}`, c)
    const land = run(`${source.slice(landStart, landEnd)};return land`, c)
    const flow = ball ? createBallFlow(() => false, land, { time: BALL_DURATION, velocity: 0 }) : createWatchFlow(() => {}, land, { position: 1, velocity: 0 })
    if (!ball) c.flowRef.current = flow
    try {
      for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { currentTarget: { getAttribute: () => '/#contact', target: '_blank' } }]) {
        exit(event(change)); expect(ball ? c.ballDesiredRef.current : c.desiredRef.current).toBe(true)
      }
      exit(event())
      expect(c.history.back).not.toHaveBeenCalled(); expect(c.onNavigate).toHaveBeenCalledOnce()
      flow.set(false, reduced)
      expect(open).toBe(reduced ? false : true); expect(contact.focus).not.toHaveBeenCalled()
      for (let tick = 0; tick < 400 && frames.size; tick++) {
        time += 16; const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(time))
        run(focus, c)
      }
      expect(open).toBe(false)
      // Landing has closed the dialog, but React has not committed non-inert home yet.
      expect(contact.focus).not.toHaveBeenCalled()
      c.ballMounted = c.mounted = false; homeInert = false
      run(focus, c)
      expect(doc.dispatchEvent).toHaveBeenCalledOnce(); expect(contact.focus).toHaveBeenCalledOnce()
      expect(contact.scrollIntoView).toHaveBeenCalledOnce(); expect(c.pendingFocusRef.current).toBeNull()
      run(focus, c); expect(contact.focus).toHaveBeenCalledOnce()
    } finally { flow.destroy(); vi.unstubAllGlobals() }
  })
})
