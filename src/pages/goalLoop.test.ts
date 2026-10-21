import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'postcss'
import App from '../App'
import { GOAL_LOOP_KITCHEN, GOAL_LOOP_HISTORY } from '../content/goalLoop'
import { ROUTES } from '../content/routes'
import { mountGoalLoopMotion } from './goalLoopMotion'

const render = (path = '/goal-loop') => renderToStaticMarkup(createElement(App, { initialPath: path }))
const stylesheet = readFileSync(new URL('./goalLoopKitchen.css', import.meta.url), 'utf8')

describe('Goal Loop kitchen story', () => {
  it('opens the dialog with the kitchen title and native Back link, retaining only the homepage watch', () => {
    const markup = render()
    const page = markup.slice(markup.indexOf('<article class="goal-loop-kitchen"'))
    expect(markup).toContain('aria-labelledby="goal-loop-title"')
    expect(page).toContain('<h1 id="goal-loop-title">Quality first.<br/><em>Speed follows.</em></h1>')
    expect(page).toContain('Goal Loop · how I deliver software')
    expect(page).toContain(GOAL_LOOP_KITCHEN.hero.body)
    expect(page).toMatch(/<a[^>]*href="\/"[^>]*><span aria-hidden="true">←<\/span> <span class="link-label">Back to homepage<\/span><\/a>/)
    expect(markup.match(/class="watch-view"/g)).toHaveLength(1)
    expect(markup).toContain('Precision,<br/>in motion.')
    expect(page).not.toMatch(/entry-watch-slot|data-watch-hero|data-calibre|class="calibre"|run-tape|Calibre|Open movement|run-reference/)
    expect(ROUTES.find(route => route.path === '/goal-loop')?.title).toBe('Goal Loop: Quality first, speed follows — Hoang Viet To')
  })

  it('renders the four approved sections in order with all five semantic station panes', () => {
    const markup = render()
    const sections = ['wrap k-hero', 'k-pass', 'wrap k-cmp', 'wrap k-wait reveal']
    const positions = sections.map(section => markup.indexOf(`class="${section}"`))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(markup.match(/class="k-pane(?: on)?"/g)).toHaveLength(5)
    expect(markup).toContain('<ol class="k-stations">')
    for (const station of GOAL_LOOP_KITCHEN.stations) {
      for (const text of [station.name, station.role, station.label, station.title, station.body, station.software]) expect(markup).toContain(text)
      if ('note' in station) expect(markup).toContain(station.note)
      if ('catch' in station) expect(markup).toContain(station.catch)
    }
    expect(GOAL_LOOP_KITCHEN.stations.map(station => [station.name, station.role])).toEqual([
      ['Ticket', 'Plan'], ['Head chef', 'Critic'], ['Cook', 'Build'], ['Taste', 'Check'], ['The pass', 'Review'],
    ])
    expect(markup).toContain('From order to plate.')
    expect(markup).toContain('Service!')
  })

  it('shortens only the phone chef label while retaining its full native expansion and desktop name', () => {
    const stations = render().match(/<ol class="k-stations">([\s\S]*?)<\/ol>/)![1]
    const items = [...stations.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1])
    expect(items).toHaveLength(5)
    expect(items[1]).toContain('<b class="k-chef-desktop">Head chef</b>')
    expect(items[1]).toContain('<b class="k-chef-phone"><abbr title="Head chef">Chef</abbr></b>')
    for (const index of [0, 2, 3, 4]) expect(items[index]).toContain(`<b>${GOAL_LOOP_KITCHEN.stations[index].name}</b>`)
    GOAL_LOOP_KITCHEN.stations.forEach((station, index) => expect(items[index]).toContain(`<span>${station.role}</span>`))

    const css = parse(stylesheet)
    const displayRules: [string, string, string][] = []
    css.walkDecls('display', declaration => {
      const rule = declaration.parent
      if (rule?.type !== 'rule' || !rule.selector.includes('k-chef-')) return
      const media = rule.parent
      displayRules.push([rule.selector, media?.type === 'atrule' ? media.params : 'all', declaration.value])
    })
    expect(displayRules).toEqual([
      ['.goal-loop-kitchen .k-stations .k-chef-phone', 'all', 'none'],
      ['.goal-loop-kitchen .k-stations .k-chef-desktop', '(max-width:480px)', 'none'],
      ['.goal-loop-kitchen .k-stations .k-chef-phone', '(max-width:480px)', 'block'],
    ])
  })

  it('includes the shared plate slots, three swaying tickets, lamps, steam, bell and the two kitchens', () => {
    const markup = render()
    expect(markup.match(/data-plate=""/g)).toHaveLength(4)
    expect(markup.match(/class="k-tk"/g)).toHaveLength(3)
    expect(markup.match(/class="k-glow"/g)).toHaveLength(2)
    for (const name of ['k-steam', 'k-bell', 'k-ding', 'k-hplate', 'k-race', 'k-legend']) expect(markup).toContain(`class="${name}"`)
    for (const copy of ['Ding!', 'Same dish, two kitchens', 'Classic flow', 'Sent back', 'Served late', 'Served', GOAL_LOOP_KITCHEN.comparison.software]) expect(markup).toContain(copy)
    expect(markup).not.toMatch(/instrument-stepper|instrument-stage-panel|Simulate failed check/)
  })

  it('keeps the approved rounded measurement consistent with the frozen audited facts', () => {
    const markup = render()
    const metric = GOAL_LOOP_HISTORY.metrics[0]
    expect((metric.before / 60).toFixed(1)).toBe('39.4')
    expect((metric.after / 60).toFixed(1)).toBe(GOAL_LOOP_KITCHEN.measurement.final.split(' ')[0])
    expect(metric.proof).toBe('395 tests before; 403 tests after, all passing.')
    expect(markup).toContain('Less waiting for the final check.')
    expect(markup).toContain('<span data-down="">39.4 min</span>')
    expect(markup).toContain('In software: full test run, 395 → 403 tests, all passing.')
    expect(markup).toContain('Goal Loop audit · 9 Aug 2026 · one machine')
    expect(markup).toContain(GOAL_LOOP_KITCHEN.measurement.body)
    expect(JSON.stringify(GOAL_LOOP_KITCHEN)).not.toMatch(/AI magic|fully autonomous|self-improving|command output|terminal output/i)
  })

  it('scopes every kitchen rule and preserves the responsive critic fixes and reduced motion', () => {
    const css = parse(stylesheet)
    css.walkRules(rule => {
      if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return
      expect(rule.selectors.every(selector => selector.startsWith('.goal-loop-kitchen') || selector.startsWith('.goal-entry > .goal-loop-kitchen'))).toBe(true)
    })
    expect(stylesheet).toContain('background:var(--tile) url(')
    expect(stylesheet).toMatch(/\.k-mover\{[^}]*isolation:isolate/)
    expect(stylesheet).toMatch(/\.k-pane\.on\{[^}]*transition:opacity \.35s \.2s,transform \.35s \.2s/)
    expect(stylesheet).toContain('left:min(92%,calc(100% - 42px))')
    for (const width of [820, 600, 480]) expect(stylesheet).toContain(`@media (max-width:${width}px)`)
    expect(stylesheet).toContain('.k-line{padding-top:2rem}')
    expect(stylesheet).toContain('.k-line{padding-top:0}')
    expect(stylesheet).toContain('margin-bottom:1.8rem')
    expect(stylesheet).toContain('.k-lane{grid-template-columns:minmax(0,1fr);gap:0}')
    expect(stylesheet).toContain('translate:-100% 0')
    expect(stylesheet).toContain('@media (prefers-reduced-motion:reduce)')
    expect(stylesheet).toContain('animation:none !important; transition:none !important')
    expect(stylesheet).toContain('.k-pane{position:static;opacity:1;transform:none}')
    expect(stylesheet).not.toMatch(/\.goal-loop\s|\.goal-loop>/)
  })

  it('preserves shell and case navigation on direct and trailing-slash routes', () => {
    for (const path of ['/goal-loop', '/goal-loop/']) {
      const markup = render(path)
      expect(markup).toContain('<nav aria-label="Primary"')
      expect(markup).toMatch(/<a(?=[^>]*href="\/goal-loop")(?=[^>]*aria-current="page")[^>]*>/)
      expect(markup).toContain('<nav aria-label="Contact and CV"')
      expect(markup).toContain('href="mailto:tohoangviet1998@gmail.com"')
      expect(markup).toContain('href="/hoang-viet-to-cv-en.docx"')
      expect(markup).toContain('href="/hoang-viet-to-cv-cz.docx"')
      expect(markup).toMatch(/aria-label="Case study navigation"><a[^>]*href="\/"[^>]*><span aria-hidden="true">←<\/span> <span class="link-label">Back to homepage<\/span><\/a><a[^>]*href="\/#contact"[^>]*><span class="link-label">Get in touch<\/span> <span aria-hidden="true">→<\/span><\/a><a[^>]*href="\/gameonvb"[^>]*><span class="link-label">Next: GameOnVB<\/span> <span aria-hidden="true">→<\/span><\/a>/)
      const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

// Execute the production mount against measured elements. This verifies dialog
// scroll, countdown and disposal without pretending to verify browser rendering.
function motionHarness(reduced = false) {
  const element = () => {
    const classes = new Set<string>(), attributes = new Map<string, string>()
    return { dataset: {} as Record<string, string>, innerHTML: '', textContent: '',
      style: { transform: '', removeProperty: vi.fn() },
      classList: { add: (...names: string[]) => names.forEach(name => classes.add(name)), remove: (...names: string[]) => names.forEach(name => classes.delete(name)), toggle(name: string, on: boolean) { if (on) classes.add(name); else classes.delete(name) }, contains: (name: string) => classes.has(name) },
      setAttribute: (name: string, value: string) => attributes.set(name, value), removeAttribute: (name: string) => attributes.delete(name), attributes,
    }
  }
  const queue = new Map<number, FrameRequestCallback>(), events = new Map<string, () => void>()
  let id = 0, top = 0
  const media = { matches: reduced, addEventListener: vi.fn((_name: string, fn: () => void) => events.set('preference', fn)), removeEventListener: vi.fn() }
  const view = { innerHeight: 800, matchMedia: () => media, performance: { now: () => 0 }, requestAnimationFrame: (fn: FrameRequestCallback) => { queue.set(++id, fn); return id }, cancelAnimationFrame: (frame: number) => queue.delete(frame), addEventListener: vi.fn((name: string, fn: () => void) => events.set(name, fn)), removeEventListener: vi.fn() }
  const doc = { defaultView: view, addEventListener: vi.fn((name: string, fn: () => void) => events.set(name, fn)), removeEventListener: vi.fn() }
  const viewport = { clientHeight: 800, getBoundingClientRect: () => ({ top: 0 }) }
  const stations = Array.from({ length: 5 }, (_, index) => ({ ...element(), offsetLeft: index * 100, offsetWidth: 100 }))
  const panes = Array.from({ length: 5 }, element), plates = Array.from({ length: 4 }, element)
  const mover = { ...element(), offsetWidth: 100, parentElement: { clientWidth: 500 } }
  const pass = { ...element(), getBoundingClientRect: () => ({ top, height: 4800 }), querySelectorAll: (selector: string) => selector === '.k-pane' ? panes : stations, querySelector: () => mover }
  const down = element(), wait = element(), race = element(), reveals = [element(), wait, race]
  const animation = { cancel: vi.fn() }
  const root = { ...element(), ownerDocument: doc, closest: () => viewport, querySelector: (selector: string) => selector === '[data-pass]' ? pass : selector === '[data-down]' ? down : wait, querySelectorAll: (selector: string) => selector === '[data-plate]' ? plates : reveals, getAnimations: () => [animation] }
  const observers: { callback: (entries: { isIntersecting: boolean; target: unknown }[]) => void; options: unknown; observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn()
    constructor(public callback: (entries: { isIntersecting: boolean; target: unknown }[]) => void, public options: unknown) { observers.push(this) }
  })
  const resize = { observe: vi.fn(), disconnect: vi.fn() }
  vi.stubGlobal('ResizeObserver', class { observe = resize.observe; disconnect = resize.disconnect })
  const cleanup = mountGoalLoopMotion(root as unknown as HTMLElement)
  return { root, pass, panes, stations, mover, plates, down, wait, race, doc, view, events, media, observers, resize, animation, queue,
    scroll(value: number) { top = value; events.get('scroll')!() },
    tick(time: number) { const batch = [...queue.values()]; queue.clear(); batch.forEach(fn => fn(time)) },
    cleanup() { cleanup(); cleanup(); vi.unstubAllGlobals() },
  }
}

it('moves through five stations using captured dialog scroll, shares plates, and cancels every observer/frame on disposal', () => {
  const h = motionHarness()
  try {
    expect(h.doc.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true, passive: true })
    expect(h.observers.every(observer => (observer.options as { root: unknown }).root !== null)).toBe(true)
    expect(h.plates.every(plate => plate.innerHTML.includes('class="k-food"'))).toBe(true)
    expect(new Set(h.plates.map(plate => plate.innerHTML)).size).toBe(1)
    for (let stage = 0; stage < 5; stage++) {
      h.scroll(-stage * 800); h.tick(16)
      expect(h.pass.dataset.stage).toBe(String(stage))
      expect(h.mover.style.transform).toBe(`translateX(${stage * 100}px)`)
      expect(h.panes.map(pane => pane.classList.contains('on'))).toEqual(h.panes.map((_, index) => index === stage))
      // Off-stage panes stay readable to screen readers; only opacity hides them.
      expect(h.panes.some(pane => pane.attributes.has('aria-hidden'))).toBe(false)
      expect(h.stations[stage].classList.contains('now')).toBe(true)
    }
    h.observers[0].callback([{ isIntersecting: true, target: h.race }])
    expect(h.race.classList.contains('in')).toBe(true)
    h.observers[1].callback([{ isIntersecting: true, target: h.wait }])
    h.tick(300); expect(h.down.textContent).toBe('39.4 min')
    h.tick(2500); expect(h.down.textContent).toBe('4.8 min')
    expect(h.wait.classList.contains('done')).toBe(true)
    h.scroll(-4000)
  } finally { h.cleanup() }
  expect(h.queue.size).toBe(0)
  expect(h.doc.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  expect(h.view.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  expect(h.media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  for (const observer of h.observers) expect(observer.disconnect).toHaveBeenCalled()
  expect(h.resize.disconnect).toHaveBeenCalledOnce()
  // CSS animations must survive a StrictMode remount, so cleanup leaves them alone.
  expect(h.animation.cancel).not.toHaveBeenCalled()
})

it.each([true, false])('reduced motion=%s lists every pane and finishes immediately, including a live preference change', initiallyReduced => {
  const h = motionHarness(initiallyReduced)
  try {
    if (!initiallyReduced) {
      h.observers[1].callback([{ isIntersecting: true, target: h.wait }])
      expect(h.queue.size).toBeGreaterThan(0)
      h.media.matches = true; h.events.get('preference')!(); h.tick(100)
    }
    expect(h.pass.dataset.stage).toBe('4')
    expect(h.down.textContent).toBe('4.8 min')
    expect(h.wait.classList.contains('done')).toBe(true)
    expect(h.panes.every(pane => pane.classList.contains('on') && !pane.attributes.has('aria-hidden'))).toBe(true)
  } finally { h.cleanup() }
  expect(h.queue.size).toBe(0)
})

it('keeps the Goal Loop header back link text unchanged', () => {
  const page = renderToStaticMarkup(createElement(App, { initialPath: '/goal-loop' }))
  expect(page).toMatch(/aria-label="Goal Loop presentation"><a class="target-link" href="\/">← Back to homepage<\/a><\/nav>/)
})

it('keeps the desktop kitchen pin short and the phone pin at 300svh', () => {
  const css = readFileSync(new URL('./goalLoopKitchen.css', import.meta.url), 'utf8')
  expect(css).toContain('.goal-loop-kitchen .k-pass{height:360vh;position:relative}')
  expect(css.slice(css.indexOf('@media (max-width:820px)'))).toContain('.goal-loop-kitchen .k-pass{height:300svh}')
})
