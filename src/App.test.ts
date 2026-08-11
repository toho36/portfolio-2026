import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App, { applyRouteMetadata, installRevealMotion } from './App'
import { readFileSync } from 'node:fs'
import { ROUTES, routeMetadata } from './content/routes'

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

describe('systems-builder shell', () => {
  it('leads with the locked identity without the old primary positioning', () => {
    const markup = render()

    expect(markup).toContain(
      'I turn messy operations into software — and software delivery into a system.',
    )
    const hero = markup.slice(
      markup.indexOf('class="hero"'),
      markup.indexOf('id="flagships"'),
    )
    expect(hero).not.toMatch(/frontend|full[-\s]?stack/i)
    expect(hero).toContain('src="/assets/systems-field.svg"')
    expect(markup).toContain('>Homepage</a>')
  })

  it('orders ordinary flagship routes inside the flagship section', () => {
    const markup = render()
    const flagships = markup.slice(
      markup.indexOf('<section id="flagships"'),
      markup.indexOf('<section id="side-quests"'),
    )

    expect(flagships.indexOf('VoleyEvents')).toBeGreaterThan(-1)
    expect(flagships.indexOf('VoleyEvents')).toBeLessThan(
      flagships.indexOf('Goal Loop'),
    )
    expect(flagships).toContain('href="/voleyevents"')
    expect(flagships).toContain('href="/goal-loop"')
    expect(flagships).not.toMatch(/GameOnVB|Screen Switch|Suburbs/)
    expect(markup.indexOf('id="side-quests"')).toBeGreaterThan(
      markup.indexOf('id="flagships"'),
    )
    expect(markup).not.toMatch(/href="#project-|<dialog|href="#"/)
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

  it('renders all four routes distinctly and falls unknown paths back to home', () => {
    const voleyEvents = render('/voleyevents/')
    const goalLoop = render('/goal-loop')
    const playground = render('/playground')
    const playgroundSlash = render('/playground/')
    const unknown = render('/not-a-route')

    expect(voleyEvents).toContain(
      'Registration and operations software for recurring recreational volleyball events.',
    )
    expect(voleyEvents).toContain('href="/"')
    expect(voleyEvents).toContain('href="/goal-loop"')
    expect(goalLoop).toContain('id="goal-loop-title"')
    expect(goalLoop).toContain('id="run-tape"')
    expect(goalLoop).toContain('href="/"')
    expect(goalLoop).toContain('href="/voleyevents"')
    for (const markup of [playground, playgroundSlash]) {
      expect(markup).toContain('id="relay-title"')
      expect(markup).toContain('>SIGNAL RELAY</h1>')
      expect(markup).toContain('id="relay-input"')
      expect(markup).toContain('id="relay-fold"')
      expect(markup).toContain('id="relay-feedback"')
      expect(markup).toContain('id="relay-closed"')
      expect(markup).toContain('<svg')
      expect(markup).not.toContain('id="goal-loop-title"')
      expect(markup).not.toContain('id="run-tape"')
    }
    expect(unknown).toContain(
      'I turn messy operations into software — and software delivery into a system.',
    )
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
