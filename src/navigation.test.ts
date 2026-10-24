import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { beginNavigation } from './App'
import { cancelNavigationCue, crossFadeProjects, focusHomeFragment, navigateSection } from './navigation'

afterEach(() => { cancelNavigationCue(); vi.unstubAllGlobals() })

it('settles the contact sheet before measuring and scrolling to its anchor', () => {
  const order: string[] = []
  const target = { style: {}, tabIndex: 0, closest: () => null,
    focus: () => order.push('focus'), scrollIntoView: () => order.push('scroll') }
  const doc = { getElementById: () => target,
    dispatchEvent: (event: Event) => { order.push(event.type); return true },
    querySelector: (selector: string) => selector === '.site-header' ? {
      getBoundingClientRect: () => { order.push('measure'); return { height: 80 } },
    } : null } as unknown as Document
  focusHomeFragment(doc, '#contact')
  expect(order).toEqual(['homefragmentfocus', 'measure', 'focus', 'scroll'])
  const source = readFileSync(new URL('./home/living/LivingVisuals.tsx', import.meta.url), 'utf8')
  expect(source).toContain("document.addEventListener('homefragmentfocus', settle)")
  expect(source).toContain("document.removeEventListener('homefragmentfocus', settle)")
})

it.each(['#contact', '#introduction'])('focuses %s below the current measured header, after the page is usable', hash => {
  let inert = true, project = true
  const target = { style: {}, tabIndex: 0, closest: () => inert ? {} : null, focus: vi.fn(), scrollIntoView: vi.fn() }
  const doc = { getElementById: vi.fn(() => target), querySelector: (selector: string) => selector === '.site-header' ? { getBoundingClientRect: () => ({ height: 125.25 }) } : project ? {} : null } as unknown as Document
  focusHomeFragment(doc, hash); inert = false; focusHomeFragment(doc, hash)
  expect(target.focus).not.toHaveBeenCalled()
  project = false; focusHomeFragment(doc, hash)
  expect(doc.getElementById).toHaveBeenLastCalledWith(hash.slice(1))
  expect(target.style).toEqual({ scrollMarginTop: '142px' })
  expect(target.tabIndex).toBe(-1)
  expect(target.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'instant', block: 'start' })
})

it.each([false, true])('keeps a nonspatial view transition with reduced motion=%s', async reduced => {
  const root = { dataset: {} as Record<string, string> }, update = vi.fn()
  const doc = { documentElement: root, visibilityState: 'visible', defaultView: { matchMedia: () => ({ matches: reduced }) },
    startViewTransition: vi.fn((callback: () => void) => { callback(); return { finished: Promise.resolve(), ready: Promise.resolve(), skipTransition() {} } }) } as unknown as Document
  crossFadeProjects(update, doc)
  expect(update).toHaveBeenCalledOnce()
  expect(doc.startViewTransition).toHaveBeenCalledOnce()
  await Promise.resolve()
  expect(root.dataset.projectSwitch).toBeUndefined()
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
  expect(css).toContain('navigation-in 90ms ease-out both !important')
  expect(css).toContain('navigation-in 200ms ease-out both')
  expect(css.match(/@keyframes navigation-(?:in|out) \{[^\n]+/g)).toHaveLength(2)
  expect(css.match(/@keyframes navigation-(?:in|out) \{[^\n]+/g)?.join('')).not.toContain('transform')
})

it.each([false, true])('provides an interruptible fallback cue (reduced=%s)', reduced => {
  const animation = { cancel: vi.fn(), finished: new Promise<void>(() => {}) }
  const animate = vi.fn(() => animation), root = { dataset: {} }
  const doc = { documentElement: root, visibilityState: 'visible', defaultView: { matchMedia: () => ({ matches: reduced }) }, getElementById: () => ({ animate }) } as unknown as Document
  crossFadeProjects(() => {}, doc)
  expect(animate).toHaveBeenCalledWith([{ opacity: .65 }, { opacity: 1 }], { duration: reduced ? 90 : 200, easing: 'ease-out' })
  beginNavigation()
  expect(animation.cancel).toHaveBeenCalledOnce()
})

it('leaves modified section links, downloads and new browsing targets native', () => {
  const target = { focus: vi.fn(), scrollIntoView: vi.fn() }, pushState = vi.fn()
  vi.stubGlobal('document', { getElementById: () => target })
  vi.stubGlobal('history', { pushState })
  for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { defaultPrevented: true }, { currentTarget: { hash: '#overview', target: '_blank', hasAttribute: () => false } }, { currentTarget: { hash: '#overview', target: '', download: '', hasAttribute: () => true } }]) {
    const event = { currentTarget: { hash: '#overview', target: '', hasAttribute: () => false }, button: 0, preventDefault: vi.fn(), ...change }
    navigateSection(event as never)
    expect(event.preventDefault).not.toHaveBeenCalled()
  }
  expect(target.focus).not.toHaveBeenCalled()
  expect(pushState).not.toHaveBeenCalled()
})

it('a section link replaces its current history entry and supersedes a pending route swap', () => {
  const callbacks: (() => void)[] = []
  const target = { tabIndex: 0, focus: vi.fn(), scrollIntoView: vi.fn() }, pushState = vi.fn(), replaceState = vi.fn(), routeUpdate = vi.fn()
  const doc = { documentElement: { dataset: {} }, visibilityState: 'visible', getElementById: () => target,
    startViewTransition: (callback: () => void) => { callbacks.push(callback); return { finished: new Promise<void>(() => {}), skipTransition: vi.fn() } } }
  vi.stubGlobal('document', doc)
  vi.stubGlobal('history', { state: { lightTableFromHome: true }, pushState, replaceState })
  vi.stubGlobal('location', { hash: '#overview' })
  const first = beginNavigation()
  crossFadeProjects(() => { if (first()) routeUpdate() }, doc as unknown as Document)
  const event = { currentTarget: { hash: '#gameonvb-top', target: '', hasAttribute: () => false }, button: 0, preventDefault: vi.fn() }
  navigateSection(event as never)
  callbacks.forEach(callback => callback())
  expect(routeUpdate).not.toHaveBeenCalled()
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(target.tabIndex).toBe(-1)
  expect(target.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'instant', block: 'start' })
  expect(pushState).not.toHaveBeenCalled()
  expect(replaceState).toHaveBeenCalledExactlyOnceWith({ lightTableFromHome: true }, '', '#gameonvb-top')
})

it('history focus preserves the browser-restored homepage scroll position', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
  const start = source.indexOf('    if (!pendingPageFocus.current) return')
  const effect = source.slice(start, source.indexOf('\n  }, [route])', start))
  const focus = vi.fn(), scrollTo = vi.fn()
  const context = { pendingPageFocus: { current: 'preserve' }, route: { path: '/' },
    window: { location: { hash: '' }, scrollTo }, document: { getElementById: () => ({ focus }) },
    isHomeFragment: () => false }
  new Function('context', `with(context){${effect}}`)(context)
  expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  expect(scrollTo).not.toHaveBeenCalled()
  expect(context.pendingPageFocus.current).toBe(false)
})
