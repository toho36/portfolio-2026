import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'postcss'
import App from '../App'
import { ROUTES } from '../content/routes'
import { VOLEYEVENTS } from '../content/voleyevents'

function render(path = '/gameonvb') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

describe('GameOnVB Match Operations case study', () => {
  it('opens with the sourced product identity and a descriptive route title', () => {
    const markup = render()
    const route = ROUTES.find(({ path }) => path === '/gameonvb')
    const hero = markup.slice(
      markup.indexOf('class="staircase-entry light-table-hero"'),
      markup.indexOf('class="gv gameonvb-story"'),
    )

    expect(hero).toContain('GameOnVB / Match operations')
    // The title and summary open the story right below the hero; the hero itself is the stairs and the ball.
    const intro = markup.slice(markup.indexOf('class="gv-intro wrap"'), markup.indexOf('class="ticker"'))
    expect(intro).toContain('<h1 id="voleyevents-title">More time on court.</h1>')
    expect(intro).toContain('Sign-ups, payments and check-in for regular recreational volleyball sessions.')
    expect(hero).not.toContain('More time on court.')
    expect(hero).not.toContain(
      'A registration and operations system for recurring recreational volleyball events.',
    )
    expect(route?.title).toBe(
      'GameOnVB Match Operations — Hoang Viet To',
    )
  })

  it('presents the approved rule, four sets, phone steps and closing in order', () => {
    const markup = render()
    const landmarks = ['class="ticker"', 'The rule I set myself', 'Four sets',
      'Set 1 · server work', 'Set 2 · the rebuild', 'Set 3 · scheduled jobs',
      'Set 4 · background work', 'The paid plan ends on 8 November 2026. GameOnVB is moving to the free plan.',
      'class="phone-col"', 'class="gv-steps"', 'When plans change',
      'Visit gameonvb.cz', 'aria-label="Case study navigation"']
    landmarks.forEach(landmark => expect(markup).toContain(landmark))
    landmarks.slice(1).forEach((landmark, index) => {
      expect(markup.indexOf(landmark)).toBeGreaterThan(markup.indexOf(landmarks[index]))
    })
    expect(markup).toContain('Run a real product for free.')
    expect(VOLEYEVENTS.sets.map(({ value, unit }) => [value, unit])).toEqual([
      ['<10', 'ms for most requests'], ['0', 'server calls per page'], ['5', 'of 5 allowed'],
      ['4', 'services reworked'], ['0 Kč', 'a month, the goal'],
    ])
    expect(markup).toContain('0 Kč')
    expect(markup).toContain('aria-label="0 Kč a month"')
    expect(markup).toContain('<div class="score" data-score="true">')
    expect(markup).toContain('Limits beaten')
    expect(markup).toContain('Before: <s>62 ms</s><span class="limit">Limit: 10 ms</span>')
    expect(markup).toContain('Before: <s>9</s><span class="limit">Limit: 5</span>')
    expect(markup).toContain('href="https://gameonvb.cz"')
    expect(markup).toContain('Cancel early.<br/>Keep your credit.')
    expect(markup).not.toMatch(/case-problem|case-pair|class="lifecycle"|Evidence boundary/)
  })

  it('keeps all four steps readable and every story link anchored', () => {
    const markup = render()
    const steps = markup.slice(markup.indexOf('class="gv-steps"'), markup.indexOf('class="gv-end"'))
    const labels = ['Pick a session.', 'Scan to pay.', 'Matched automatically.', 'Check in at the door.']
    expect(VOLEYEVENTS.steps.map(({ title }) => title)).toEqual(labels)
    expect([...steps.matchAll(/data-step="([0-3])"/g)].map(match => Number(match[1]))).toEqual([0, 1, 2, 3])
    for (const step of VOLEYEVENTS.steps) {
      expect(steps).toContain(`id="${step.id}"`)
      expect(steps).toContain(`<h2>${step.title}</h2>`)
      expect(steps).toContain(step.body)
    }
    expect(steps).not.toMatch(/<h2[^>]*aria-hidden|<p[^>]*aria-hidden/)
    const hero = markup.slice(markup.indexOf('class="gv-jump"'), markup.indexOf('class="ticker"'))
    for (const [, id] of hero.matchAll(/href="#([^"]+)"/g)) {
      expect(markup.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1)
    }
    expect(markup.match(/data-screen="[0-3]"/g)).toHaveLength(4)
    for (const text of ['Sign up', 'Scan in any Czech bank app', 'Confirmed', 'Door list · Tue']) expect(markup).toContain(text)
  })

  it('gives each step its own readable app screen for phones', () => {
    const markup = render()
    expect(markup.match(/class="step-screen" aria-hidden="true"/g)).toHaveLength(4)
    const firstStep = markup.slice(markup.indexOf('data-step="0"'), markup.indexOf('data-step="1"'))
    expect(firstStep).toContain('Sign up')
  })

  it('scopes the approved responsive and reduced-motion rules below the hero', () => {
    const css = readFileSync(new URL('./gameOnVb.css', import.meta.url), 'utf8')
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(css).toMatch(/@media\s*\(max-width:\s*820px\)/)
    expect(css).toMatch(/@media\s*\(max-width:\s*600px\)/)
    expect(css).toMatch(/scroll-snap-type: x mandatory/)
    // Long set units must wrap inside the card instead of widening it past the phone viewport.
    expect(css).toMatch(/\.gv \.set \{ flex: 0 0 min\(78vw, 560px\); min-width: 0;/)
    expect(css).not.toMatch(/\.gv \.set \.big small \{[^}]*nowrap/)
    expect(css).toMatch(/\.gv \.band \{ height: auto; \}/)
    expect(css).toMatch(/\.gv \.phone-col \{ display: none; \}/)
    expect(css).toMatch(/padding: clamp\(48px, 10vw, 72px\) 0/)
    expect(css).toMatch(/height:\s*3px/)
    expect(css).toMatch(/rotate\(-8deg\)/)
    expect(css).toContain('#e2553a')
    expect(css).toMatch(/text-wrap:\s*pretty/)
    const rules = parse(css)
    rules.walkRules(rule => {
      if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return
      // Page rules stay under .gv; only the phone-size hero text fixes reach the shared hero, under .voleyevents.
      rule.selectors.forEach(selector => expect(selector).toMatch(/^\.gv(?:[ :.]|$)|^\.voleyevents \.(?:entry-header|ball-entry-caption|ball-story-links|case-navigation|ball-play-handle|ball-play-hint|ball-entry-copy|staircase-entry|light-table-hero)\b/))
    })
    const reduced: Record<string, string> = {}
    rules.walkAtRules('media', media => {
      if (!media.params.includes('prefers-reduced-motion')) return
      media.walkRules('.gv .track', rule => { rule.walkDecls(decl => { reduced[decl.prop] = decl.value }) })
    })
    expect(reduced).toMatchObject({ 'flex-wrap': 'wrap', transform: 'none', width: 'min(84rem, calc(100% - 3rem))' })
    expect(css).not.toMatch(/gv-hero|\.dial|\.lane|\.seg|\.legend|wait-row|\.big s\b/)
  })

  it('offers the transferred upper-tread hero before the complete ungated story', () => {
    const markup = render()
    const hero = markup.slice(markup.indexOf('class="staircase-entry light-table-hero"'), markup.indexOf('class="gv gameonvb-story"'))
    expect(hero).toContain('Drag the ball and let go to throw it down the stairs.')
    expect(hero.match(/data-ball-hero="true"/g)).toHaveLength(1)
    expect(hero).toContain('data-cold-ball-fallback="true"')
    expect(hero).toContain('The same volleyball landing on the upper stone tread')
    expect(hero).toContain('assets/ball-preview.png')
    expect(hero).not.toMatch(/data-stair-root|Release the ball|Catch\. Pull\.|Reset /)
    // The sticky section bar opens the story below the hero; every link has exactly one target section.
    const jump = markup.slice(markup.indexOf('class="gv-jump"'), markup.indexOf('class="gv-intro wrap"'))
    expect(VOLEYEVENTS.sections.map(section => section.label)).toEqual(['Overview', 'Free plan', 'Limits', 'How it works', 'Plans change'])
    for (const section of VOLEYEVENTS.sections) {
      expect(hero).not.toContain(`href="#${section.id}"`)
      expect(jump).toContain(`href="#${section.id}">${section.label}</a>`)
      expect(markup.match(new RegExp(`<section[^>]*id="${section.id}"`, 'g'))).toHaveLength(1)
    }
    expect(markup).not.toMatch(/playable-court|Scroll follows one participant|Separate full case|landing prototype/)
  })

  it('keeps the page free of eager graphics imports and retired rally code', () => {
    const markup = render()
    const source = readFileSync(
      new URL('./VoleyEvents.tsx', import.meta.url),
      'utf8',
    )

    expect(markup).not.toMatch(/<canvas|data-rally-|class="rally-/)
    expect(source).toContain("import { Staircase } from '../components/Staircase'")
    expect(source).not.toMatch(
      /\b(?:gsap|three|canvas|requestAnimationFrame)\b|rally|RuntimeBoundary/i,
    )
    expect(source).not.toMatch(/src\/playground|\.\.\/playground/)
  })

  it('preserves shared shell navigation on direct and trailing-slash routes', () => {
    for (const path of ['/gameonvb', '/gameonvb/']) {
      const markup = render(path)

      expect(markup).toContain('<nav aria-label="Primary"')
      expect(markup).toMatch(
        /<a(?=[^>]*href="\/gameonvb")(?=[^>]*aria-current="page")[^>]*>/,
      )
      expect(markup).toContain('<nav aria-label="Contact and CV"')
      expect(markup).toContain('href="mailto:tohoangviet1998@gmail.com"')
      expect(markup).toContain('href="/hoang-viet-to-cv-en.docx"')
      expect(markup).toContain('href="/hoang-viet-to-cv-cz.docx"')
      expect(markup).toContain('href="/">')
      expect(markup).toContain('href="/goal-loop"')
      expect(markup).toContain('Back to homepage')
      expect(markup).toContain('Next: Goal Loop')
      expect(markup).toMatch(/aria-label="Case study navigation">[\s\S]*?<a class="target-link contact-link" href="\/#contact"><span class="link-label">Get in touch<\/span> <span aria-hidden="true">→<\/span><\/a>/)
      expect(markup).not.toMatch(/<canvas|data-rally-runtime/)
    }
  })

  it('keeps claims free of invented metrics, testimonials and unapproved media', () => {
    const content = JSON.stringify(VOLEYEVENTS)
    const markup = render()

    expect(content).not.toMatch(/%|€|\$|£|customer quote|testimonial|payments total/i)
    const story = markup.slice(markup.indexOf('class="gv gameonvb-story"'))
    expect(story).not.toMatch(/<canvas|<video|data:image|dashboard screenshot/i)
    expect(markup).not.toMatch(/<canvas|<video|dashboard screenshot/i)
    // The case study lives in the ball-entry dialog; the homepage section behind it has its own single ball.
    const caseStudy = markup.slice(markup.indexOf('<dialog class="ball-entry"'))
    const images = [...caseStudy.matchAll(/<(?:img|image)[^>]*(?:src|href)="([^"]+)"/g)].map(m => m[1])
    expect(images).toHaveLength(7)
    const homeSection = markup.slice(markup.indexOf('data-poster="gameonvb"'), markup.indexOf('data-poster="solidpixels"'))
    expect([...homeSection.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m => m[1])).toEqual([expect.stringMatching(/\/assets\/ball-preview\.png$/)])
    expect(images[0]).toMatch(/^data:image\/svg\+xml,/)
    for (const image of images.slice(1)) expect(image).toMatch(/\/assets\/ball-preview\.png$/)
    expect(story.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(5)
  })
})

// Geometry and event ownership are exercised without a browser renderer.
function motionFixture(reduced = false, width = 1440) {
  const classes = () => {
    const values = new Set<string>()
    return { contains: (name: string) => values.has(name), add: (name: string) => values.add(name),
      remove: (name: string) => values.delete(name),
      toggle(name: string, on: boolean) { if (on) values.add(name); else values.delete(name) } }
  }
  const element = (top = 0, height = 620) => ({
    classList: classes(), style: { transform: '', removeProperty: vi.fn() }, textContent: '',
    getBoundingClientRect: () => ({ top, height, width, bottom: top + height }),
  })
  const band = element(0, 4200), track = { ...element(400), scrollWidth: 3000, scrollLeft: 0, clientWidth: 1440 }
  const scoreLabel = { ...element(), textContent: 'Limits beaten' }
  const won = element(), pips = Array.from({ length: 4 }, () => element())
  const number = { offsetLeft: 0, offsetWidth: 140, offsetTop: 0, offsetHeight: 80 }
  const steps = Array.from({ length: 4 }, (_, i) => ({ ...element(i * 620),
    querySelector: () => ({ ...number, offsetTop: i * 620 }) }))
  const screens = Array.from({ length: 4 }, () => element())
  const hopAnimation = { cancel: vi.fn() }, cssAnimation = { cancel: vi.fn() }
  const stepBall = { ...element(), animate: vi.fn(() => hopAnimation) }
  const bandBall = { ...element(), parentElement: element() }
  const reveal = element(), phone = element(42, 330)
  const elements: Record<string, unknown> = { '[data-band]': band, '[data-track]': track,
    '[data-won]': won, '[data-score-label]': scoreLabel, '.phone-col': phone, '[data-band-ball]': bandBall, '[data-step-ball]': stepBall }
  const lists: Record<string, unknown[]> = { '[data-step]': steps, '[data-screen]': screens,
    '.pips i': pips, '.reveal': [reveal] }
  const listeners = new Map<string, EventListener>()
  const add = vi.fn((name: string, fn: EventListener) => listeners.set(name, fn))
  const remove = vi.fn((name: string) => listeners.delete(name))
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  const media = { matches: reduced, addEventListener: add, removeEventListener: remove }
  const view = { innerWidth: width, innerHeight: 1000, matchMedia: () => media,
    addEventListener: add, removeEventListener: remove,
    requestAnimationFrame(fn: FrameRequestCallback) { frames.set(++frameId, fn); return frameId },
    cancelAnimationFrame(id: number) { frames.delete(id) } }
  const docAdd = vi.fn(add), docRemove = vi.fn(remove)
  const doc = { defaultView: view, addEventListener: docAdd, removeEventListener: docRemove }
  const disconnect = vi.fn(), observe = vi.fn()
  const root = { ownerDocument: doc, clientWidth: width, dataset: {} as Record<string, string>,
    querySelector: (selector: string) => elements[selector], querySelectorAll: (selector: string) => lists[selector] ?? [],
    closest: () => null, getAnimations: () => [cssAnimation] }
  vi.stubGlobal('IntersectionObserver', class { observe = observe; unobserve() {}; disconnect = disconnect })
  vi.stubGlobal('ResizeObserver', class { observe() {}; disconnect = disconnect })
  return { root: root as unknown as HTMLElement, band, track, won, scoreLabel, pips, steps, screens,
    stepBall, bandBall, reveal, media, listeners, add: docAdd, remove: docRemove, frames, disconnect, hopAnimation, cssAnimation,
    scroll() { listeners.get('scroll')!(new Event('scroll')); this.flush() },
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(0)) } }
}

describe('GameOnVB dialog motion', () => {
  it('drives the band and phone from captured document scroll and cleans up all ownership', async () => {
    const { mountGameOnVbMotion } = await import('./gameOnVbMotion')
    const h = motionFixture()
    const cleanup = mountGameOnVbMotion(h.root)
    try {
      expect(h.add).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true, passive: true })
      expect(h.won.textContent).toBe('0')
      h.band.getBoundingClientRect = () => ({ top: -3200, height: 4200, width: 1440, bottom: 1000 })
      h.steps.forEach((step, i) => { step.getBoundingClientRect = () => ({ top: i * 620 - 700, height: 620, width: 1440, bottom: i * 620 - 80 }) })
      h.scroll()
      expect(h.track.style.transform).toBe('translateX(-1608px)')
      expect(h.won.textContent).toBe('4')
      expect(h.pips.every(pip => pip.classList.contains('on'))).toBe(true)
      expect(h.screens[1].classList.contains('on')).toBe(true)
      expect(h.stepBall.animate).toHaveBeenCalledTimes(1)
      h.listeners.get('scroll')!(new Event('scroll'))
      expect(h.frames.size).toBe(1)
      cleanup()
      expect(h.frames.size).toBe(0)
      expect(h.listeners.size).toBe(0)
      expect(h.remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
      expect(h.disconnect).toHaveBeenCalled()
      expect(h.hopAnimation.cancel).toHaveBeenCalled()
      expect(h.cssAnimation.cancel).toHaveBeenCalled()
    } finally { cleanup(); vi.unstubAllGlobals() }
  })

  it('responds to a reduced-motion preference change during a hop', async () => {
    const { mountGameOnVbMotion } = await import('./gameOnVbMotion')
    const h = motionFixture()
    const cleanup = mountGameOnVbMotion(h.root)
    try {
      h.steps[1].getBoundingClientRect = () => ({ top: 400, height: 200, width: 1440, bottom: 600 })
      h.scroll()
      expect(h.stepBall.animate).toHaveBeenCalledTimes(1)
      h.media.matches = true
      h.listeners.get('change')!(new Event('change'))
      h.flush()
      expect(h.hopAnimation.cancel).toHaveBeenCalled()
      expect(h.stepBall.animate).toHaveBeenCalledTimes(1)
      expect(h.won.textContent).toBe('4')
      expect(h.track.style.transform).toBe('translateX(0px)')
    } finally { cleanup(); vi.unstubAllGlobals() }
  })

  it('lets phones swipe the cards natively and reads the score from the swipe position', async () => {
    const { mountGameOnVbMotion } = await import('./gameOnVbMotion')
    const h = motionFixture(false, 390)
    Object.assign(h.track, { scrollLeft: 0, clientWidth: 390, scrollWidth: 2390 })
    const cleanup = mountGameOnVbMotion(h.root)
    try {
      expect(h.track.style.removeProperty).toHaveBeenCalledWith('transform')
      // The card in view counts as beaten: Set 1 shows 1 / 4.
      expect(h.won.textContent).toBe('1')
      h.track.scrollLeft = 1000; h.scroll(); expect(h.won.textContent).toBe('3')
      expect(h.scoreLabel.textContent).toBe('Set')
      h.track.scrollLeft = 2000; h.scroll(); expect(h.won.textContent).toBe('4')
      expect(h.scoreLabel.textContent).toBe('Limits beaten')
    } finally { cleanup(); vi.unstubAllGlobals() }
  })

  it('selects the step nearest the viewport middle on phones and skips rolling and hopping for reduced motion', async () => {
    const { mountGameOnVbMotion } = await import('./gameOnVbMotion')
    const h = motionFixture(true, 390)
    h.steps.forEach((step, i) => { step.getBoundingClientRect = () => ({ top: 350 + i * 300, height: 200, width: 390, bottom: 550 + i * 300 }) })
    const cleanup = mountGameOnVbMotion(h.root)
    try {
      expect(h.screens[0].classList.contains('on')).toBe(true)
      expect(h.won.textContent).toBe('4')
      // Phones never transform the track; the cards scroll natively.
      expect(h.track.style.removeProperty).toHaveBeenCalledWith('transform')
      const ball = h.bandBall.style.transform
      h.steps[2].getBoundingClientRect = () => ({ top: 410, height: 200, width: 390, bottom: 610 })
      h.scroll()
      expect(h.screens[2].classList.contains('on')).toBe(true)
      expect(h.bandBall.style.transform).toBe(ball)
      expect(h.stepBall.animate).not.toHaveBeenCalled()
    } finally { cleanup(); vi.unstubAllGlobals() }
  })
})

it('underlines only the words of project footer links and uses one arrow style', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
  expect(css).toMatch(/:is\(\.case-navigation, \.k-navigation\) a \{[^}]*text-decoration: none/)
  expect(css).toMatch(/:is\(\.case-navigation, \.k-navigation\) \.link-label \{[^}]*text-decoration: underline/)
  for (const path of ['/gameonvb', '/goal-loop']) {
    const html = renderToStaticMarkup(createElement(App, { initialPath: path }))
    const nav = html.slice(html.indexOf('aria-label="Case study navigation"'))
    const footer = nav.slice(0, nav.indexOf('</nav>'))
    expect(footer).not.toContain('↗')
    expect(footer.match(/<a /g)).toHaveLength(3)
    expect(footer.match(/<span class="link-label">/g)).toHaveLength(3)
    expect(footer.match(/<span aria-hidden="true">[←→]<\/span>/g)).toHaveLength(3)
  }
})

it('gives Get in touch the same footer type style as Back and Next', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
  expect(css).toMatch(/\.voleyevents \.back-link,\n\.voleyevents \.contact-link,\n\.voleyevents \.next-link \{\n  color: var\(--court-ink\);/)
  expect(css).toMatch(/\n\.contact-link,\n\.next-link \{\n  width: fit-content;[^}]*font-weight: 800;[^}]*text-transform: uppercase;/)
})
