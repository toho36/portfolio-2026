import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import App, { applyRouteMetadata, installRevealMotion, isLightTablePair, selectHomeTransition } from './App'
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
    getRouteNavigationUrl, normalizePathname, pushRouteNavigation, isLightTablePair, selectHomeTransition,
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
    expect(css).toContain(':has(.ball-entry[open], .goal-entry[open])')
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
