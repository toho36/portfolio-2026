import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App, { applyRouteMetadata, installRevealMotion, selectHomeTransition } from './App'
import { readFileSync } from 'node:fs'
import { ROUTES, resolveRoute, routeMetadata } from './content/routes'

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

describe('poster homepage shell', () => {
  it('renders the approved hero and all seven posters in order', () => {
    const markup = render()
    expect(markup).toContain('New tools.')
    expect(markup).toContain('Old standards.')
    expect([...markup.matchAll(/data-poster="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'hero', 'gameonvb', 'solidpixels', 'goal-loop', 'playground', 'tools', 'contact',
    ])
    expect(markup).toContain('data-home-state="static"')
    expect(markup).toContain('>Homepage</a>')
  })

  it('links approved projects and keeps SolidPixels and Small tools non-link', () => {
    const markup = render()
    expect(markup).toContain('href="/gameonvb"')
    expect(markup).toContain('href="/goal-loop"')
    expect(markup).toContain('href="/playground"')
    const solid = markup.slice(markup.indexOf('data-poster="solidpixels"'), markup.indexOf('data-poster="goal-loop"'))
    expect(solid).not.toContain('<a ')
    const tools = markup.slice(markup.indexOf('data-poster="tools"'), markup.indexOf('data-poster="contact"'))
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
    const contact = markup.slice(markup.indexOf('data-poster="contact"'))
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
      'Registration and operations software for recurring recreational volleyball events.',
    )
    expect(gameOnVB).toContain('href="/"')
    expect(gameOnVB).toContain('href="/goal-loop"')
    expect(goalLoop).toContain('id="goal-loop-title"')
    expect(goalLoop).toContain('id="run-tape"')
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
