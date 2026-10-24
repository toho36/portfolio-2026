import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parse } from 'postcss'
import App from '../../App'

const render = (path: string) => renderToStaticMarkup(createElement(App, { initialPath: path }))
const css = parse(readFileSync(new URL('./lightTable.css', import.meta.url), 'utf8'))
// Resolve the actual declarations at these exact component selectors. This is
// a stylesheet/markup contract, not a browser layout or pointer-hit assertion.
function declarations(selector: string, width: number) {
  const values: Record<string, string> = {}
  css.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return
    const parent = rule.parent
    if (parent?.type === 'atrule') {
      if (parent.name !== 'media' || !parent.params.includes('max-width:760px') || width > 760) return
    }
    rule.walkDecls(declaration => { values[declaration.prop] = declaration.value })
  })
  return values
}

it('preserves the footer grid and existing one-column mobile contract', () => {
  const globalCss = parse(readFileSync(new URL('../../styles.css', import.meta.url), 'utf8'))
  let mobileColumns: string | undefined
  globalCss.walkAtRules('media', media => {
    if (!/max-width:\s*760px/.test(media.params)) return
    media.walkRules('footer', rule => {
      rule.walkDecls('grid-template-columns', declaration => { mobileColumns = declaration.value })
    })
  })
  expect(mobileColumns).toBe('1fr')
  for (const width of [320, 390, 1440]) {
    expect(declarations('.site-shell:has([data-light-table-shell]) > footer', width)).toEqual({ display: 'grid' })
  }
})

it('places the Back bar below the measured shell header at mobile and desktop widths', () => {
  for (const width of [390, 1440]) {
    expect(declarations('.ball-entry .entry-header', width).top).toBe('var(--shell-header-height,0px)')
    expect(declarations('.entry-header :is(button,a)', width)['min-height']).toBe('44px')
  }
})

it('reserves the measured shell header for native chapter scrolling', () => {
  for (const width of [390, 1440]) {
    expect(declarations('.ball-entry', width)['scroll-padding-top']).toBe('var(--shell-header-height,0px)')
  }
})

it('keeps the ball and throw hint with immediate product copy; chapter links start the story below', () => {
  const html = render('/gameonvb')
  for (const width of [390, 1440]) {
    expect(declarations('.ball-entry-caption', width).position ?? 'static').toBe('static')
    expect(declarations('.ball-entry-copy', width)).toMatchObject({ position: 'absolute', bottom: '8px', display: 'flex', 'flex-direction': 'column' })
  }
  expect(/class="ball-entry-copy"><div class="ball-entry-caption">[\s\S]*?<\/div><\/div>/.test(html)).toBe(true)
  expect(html).not.toContain('ball-story-links')
  expect(html.indexOf('class="gv-jump"')).toBeGreaterThan(html.indexOf('class="ball-entry-copy"'))
  expect(html.indexOf('<h1 id="voleyevents-title">')).toBeLessThan(html.indexOf('class="ball-entry-copy"'))
  for (const id of ['overview', 'free-plan', 'limits', 'how-it-works', 'plans-change']) expect(html).toContain(`href="#${id}"`)
})
it('renders two real-path fan sheets with native supporting content on project routes', () => {
  const html = render('/gameonvb')
  expect([...html.matchAll(/data-sheet="([^"]+)"/g)].map(m => m[1])).toEqual(['goal-loop', 'gameonvb'])
  expect(html).not.toContain('data-sheet="intro"')
  expect(html).toContain('href="/gameonvb"')
  expect(html).toContain('href="/goal-loop"')
  expect(html).toContain('name="_honey"')
  expect(html).toContain('Swap windows between displays')
  expect(html).not.toMatch(/poster-canvas-host|poster-track|localhost|127\.0\.0\.1|study 013|Separate full case/)
})
it('cold canonical and slash paths expose one same-model hero and the complete story', () => {
  for (const path of ['/gameonvb', '/gameonvb/']) {
    const html = render(path)
    expect(html.match(/data-light-table-shell/g)).toHaveLength(1)
    expect(html.match(/data-ball-hero/g)).toHaveLength(1)
    expect(html).toContain('data-cold-ball-fallback')
    expect(html).not.toContain('data-stair-root')
    expect(html.match(/<main\b/g)).toHaveLength(1)
    expect(html.match(/<header\b/g)).toHaveLength(1)
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ['event-opens', 'player-registers', 'payment-matches', 'attendance-resolves']) expect(html).toContain(`id="${id}"`)
  }
})
it('uses one persistent App seam and App navigation for the eligible pair', () => {
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
  expect(app).toContain('<LightTable pathname={route.path}')
  expect(app.match(/<LightTable\b/g)).toHaveLength(1)
  expect(app).toContain('isLightTablePair')
})

it('real Goal Loop routes open the kitchen hero while the watch remains in its homepage card', () => {
  for (const path of ['/goal-loop', '/goal-loop/']) {
    const html = render(path)
    expect(html.match(/data-light-table-shell/g)).toHaveLength(1)
    expect(html.match(/class="wrap k-hero"/g)).toHaveLength(1)
    expect(html.match(/class="watch-view"/g)).toHaveLength(1)
    expect(html).toContain('class="goal-entry" open=""')
    expect(html).toContain('<h1 id="goal-loop-title">Quality first.<br/><em>Speed follows.</em></h1>')
    expect(html).not.toMatch(/data-calibre|class="calibre"|Separate full case|iframe/)
    expect(html.match(/class="k-pane(?: on)?"/g)).toHaveLength(5)
    expect(html).toContain('id="kitchen-pass"')
    expect(html).not.toMatch(/entry-watch-slot|data-watch-hero|class="goal-loop"/)
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
    expect(new Set(ids).size).toBe(ids.length)
    for (const width of [390, 1440]) {
      expect(declarations('.goal-entry', width)).toMatchObject({ '--ink': '#e7e5de', '--paper': '#343c34' })
      expect(declarations('.goal-entry', width)['scroll-padding-top']).toBe('var(--shell-header-height,0px)')
    }
  }
})

it('deals the next or previous card from a mouse, pen or finger drag and swallows only the click after a mouse drag', () => {
  const source = readFileSync(new URL('./LightTable.jsx', import.meta.url), 'utf8')
  const handlers = source.slice(source.indexOf('  const swipeRef=useRef(null)'), source.indexOf('  return <div data-light-table-shell'))
  const selected: number[] = [], listeners = new Map<string, Set<(event: any) => void>>(), timers = new Map<number, () => void>()
  let cleanup: (() => void) | undefined, id = 0
  const context = { useRef: (current: unknown) => ({ current }), useEffect: (fn: () => () => void) => { cleanup = fn() }, active: 1, sheets: [{}, {}, {}], select: (i: number) => selected.push(i),
    setTimeout: (fn: () => void) => { timers.set(++id, fn); return id }, clearTimeout: (t: number) => timers.delete(t),
    addEventListener: (type: string, fn: (event: any) => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(fn) },
    removeEventListener: (type: string, fn: (event: any) => void) => listeners.get(type)?.delete(fn) }
  const { swipeStart, draggedRef, swipeRef, activeRef } = new Function('context', `with(context){${handlers};return {swipeStart,draggedRef,swipeRef,activeRef}}`)(context)
  const emit = (type: string, event: any = {}) => listeners.get(type)?.forEach(fn => fn(event))
  const flush = () => { const run = [...timers.values()]; timers.clear(); run.forEach(fn => fn()) }
  // Releases are handled at window level, so a pointer released outside the fan still finishes the gesture.
  const drag = (pointerType: string, dx: number, dy = 0, button = 0) => {
    swipeStart({ isPrimary: true, pointerType, button, clientX: 200, clientY: 300 })
    emit('pointerup', { pointerType, clientX: 200 + dx, clientY: 300 + dy })
  }
  expect(listeners.get('pointerup')!.size).toBe(1); expect(listeners.get('pointercancel')!.size).toBe(1)
  drag('mouse', -80); expect(draggedRef.current).toBe(true); flush(); expect(selected).toEqual([2]); expect(draggedRef.current).toBe(false)
  drag('pen', 80); flush(); expect(selected).toEqual([2, 0])
  drag('touch', -80); expect(draggedRef.current).toBe(false); flush(); expect(selected).toEqual([2, 0, 2])
  drag('mouse', -30); drag('mouse', -60, 80); drag('mouse', -80, 0, 2); flush()
  expect(selected).toEqual([2, 0, 2]); expect(draggedRef.current).toBe(false)
  // A cancelled gesture leaves nothing behind for the next one, which uses the current card.
  swipeStart({ isPrimary: true, pointerType: 'mouse', button: 0, clientX: 200, clientY: 300 }); emit('pointercancel'); expect(swipeRef.current).toBeNull()
  emit('pointerup', { pointerType: 'mouse', clientX: 0, clientY: 300 }); flush(); expect(selected).toEqual([2, 0, 2])
  activeRef.current = 2; drag('mouse', 80); flush(); expect(selected).toEqual([2, 0, 2, 1])
  expect(listeners.get('pointerup')!.size).toBe(1); expect(listeners.get('pointercancel')!.size).toBe(1)
  // Unmount removes both listeners and drops a pending selection.
  drag('mouse', -80); cleanup!(); flush(); expect(selected).toEqual([2, 0, 2, 1])
  expect(listeners.get('pointerup')!.size).toBe(0); expect(listeners.get('pointercancel')!.size).toBe(0)
  expect(source).toMatch(/onClickCapture=\{event=>\{if\(draggedRef\.current\)\{draggedRef\.current=false;event\.preventDefault\(\);event\.stopPropagation\(\)\}\}\}/)
  expect(source).toMatch(/onDragStart=\{event=>event\.preventDefault\(\)\}/)
  expect(declarations('.light-table', 1440)['user-select']).toBe('none')
})

it('returns from GameOnVB with the site header back at once and the case header fading in its dark theme', () => {
  const source = readFileSync(new URL('./lightTable.css', import.meta.url), 'utf8')
  const worlds = readFileSync(new URL('../../worlds.css', import.meta.url), 'utf8')
  expect(source).not.toContain(".goal-entry[open]) > .site-header { display: none; }")
  expect(source).toContain(".ball-entry[data-phase='leaving'] .entry-header { opacity: var(--progress); }")
  expect(worlds).toMatch(/:is\(\.route-voleyevents, \.ball-entry\) \.voleyevents \{ --court-chalk: var\(--ink\); --court-ink: var\(--paper\);/)
})
