import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { ROUTES } from '../content/routes'
import {
  VOLEYEVENTS,
  VOLEYEVENTS_LIFECYCLE,
} from '../content/voleyevents'
import { createVoleyEventsRuntimeBoundary } from './VoleyEvents'

function render(path = '/voleyevents') {
  return renderToStaticMarkup(createElement(App, { initialPath: path }))
}

describe('VoleyEvents Match Operations case study', () => {
  it('opens with the sourced product identity and a descriptive route title', () => {
    const markup = render()
    const route = ROUTES.find(({ path }) => path === '/voleyevents')
    const hero = markup.slice(
      markup.indexOf('class="court-hero"'),
      markup.indexOf('class="case-section'),
    )

    expect(hero).toContain('VoleyEvents / Match operations')
    expect(hero).toContain(
      'Registration and operations software for recurring recreational volleyball events.',
    )
    expect(hero).toContain(
      'A registration and operations system for recurring recreational volleyball events.',
    )
    expect(route?.title).toBe(
      'VoleyEvents Match Operations — Hoang Viet To',
    )
  })

  it('keeps problem, constraints, decisions, lifecycle, evidence and status in reading order', () => {
    const markup = render()
    const landmarks = [
      'The operational problem',
      'Constraint',
      'System decision',
      'One registration / one operational record',
      'Evidence boundary',
      'Current status',
    ]

    landmarks.forEach((landmark) => expect(markup).toContain(landmark))
    landmarks.slice(1).forEach((landmark, index) => {
      expect(markup.indexOf(landmark)).toBeGreaterThan(
        markup.indexOf(landmarks[index]),
      )
    })
  })

  it('explains one complete registration lifecycle in the required order', () => {
    const markup = render()
    const lifecycle = markup.slice(
      markup.indexOf('<section id="lifecycle"'),
      markup.indexOf('class="case-pair case-closing"'),
    )
    const labels = [
      'Event opens',
      'Player registers',
      'Payment matches',
      'Attendance resolves',
    ]

    expect(VOLEYEVENTS_LIFECYCLE.map(({ label }) => label)).toEqual(labels)
    labels.forEach((label) => expect(lifecycle).toContain(label))
    labels.slice(1).forEach((label, index) => {
      expect(lifecycle.indexOf(label)).toBeGreaterThan(
        lifecycle.indexOf(labels[index]),
      )
    })
    expect(lifecycle).toMatch(/registration/i)
    expect(lifecycle).toMatch(/QR-bank payment matching/i)
    expect(lifecycle).toMatch(/cancellation credit/i)
    expect(lifecycle).toMatch(/attendance/i)
    expect(lifecycle).toMatch(/admin operations/i)
    expect(lifecycle).toMatch(/audit/i)
  })

  it('retains complete semantic stage content without relying on the illustration', () => {
    const markup = render()
    const lifecycle = markup.slice(
      markup.indexOf('<section id="lifecycle"'),
      markup.indexOf('class="case-pair case-closing"'),
    )

    expect(lifecycle).toContain('<ol class="lifecycle-track">')
    expect(lifecycle.match(/<li class="lifecycle-stage"/g)).toHaveLength(4)
    for (const stage of VOLEYEVENTS_LIFECYCLE) {
      expect(lifecycle).toContain(`id="${stage.id}"`)
      expect(lifecycle).toContain(`<h3>${stage.label}</h3>`)
      expect(lifecycle).toContain(stage.body)
      expect(stage.handles).not.toHaveLength(0)
    }
    expect(lifecycle).not.toMatch(/<h3[^>]*aria-hidden|<p[^>]*aria-hidden/)
  })

  it('owns one semantic rally stage and four ordered decorative landings', () => {
    const markup = render()
    const heroStart = markup.indexOf('class="court-hero"')
    const heroEnd = markup.indexOf('</section>', heroStart)
    const bandStart = markup.indexOf('class="rally-band"')
    const stageStart = markup.indexOf('data-rally-stage="true"')
    const problemStart = markup.indexOf('class="case-section case-problem"')
    const bandTagStart = markup.lastIndexOf('<div', bandStart)
    const problemTagStart = markup.lastIndexOf('<section', problemStart)
    const fallbackStart = markup.indexOf('data-rally-fallback="true"')
    const fallbackEnd = markup.indexOf('</svg>', fallbackStart)
    const fallback = markup.slice(fallbackStart, fallbackEnd)
    const band = markup.slice(bandTagStart, problemTagStart)
    const stageOpen = markup.slice(
      markup.lastIndexOf('<div', stageStart),
      markup.indexOf('>', stageStart) + 1,
    )
    const fallbackOpen = markup.slice(
      markup.lastIndexOf('<svg', fallbackStart),
      markup.indexOf('>', fallbackStart) + 1,
    )
    const landings = Array.from(
      markup.matchAll(/data-rally-landing="([^"]+)"/g),
      (match) => match[1],
    )

    expect(markup).toMatch(
      /<article class="voleyevents" data-rally-root="true">/,
    )
    expect(markup.match(/data-rally-stage="true"/g)).toHaveLength(1)
    expect(markup.match(/data-rally-fallback="true"/g)).toHaveLength(1)
    expect(markup.match(/class="rally-band"/g)).toHaveLength(1)
    expect(markup.match(/class="rally-plane(?:\s|\")/g)).toHaveLength(5)
    expect(markup.slice(heroEnd, stageStart)).toBe(
      '</section><div class="rally-band"><div class="rally-stage" ',
    )
    expect(bandStart).toBeGreaterThan(heroEnd)
    expect(bandStart).toBeLessThan(stageStart)
    expect(stageStart).toBeGreaterThan(heroEnd)
    expect(stageStart).toBeLessThan(problemStart)
    expect(landings).toEqual(
      VOLEYEVENTS_LIFECYCLE.map(({ id }) => id),
    )
    expect(stageOpen).toContain('aria-hidden="true"')
    expect(fallbackOpen).toContain('aria-hidden="true"')
    expect(fallback).not.toMatch(/<(?:h[1-6]|p)\b/)
    expect(band).not.toMatch(/<(?:section|h[1-6]|p|a)\b/)
    expect(markup).toContain(
      '</svg></div></div><section class="case-section case-problem"',
    )
    expect(markup).not.toMatch(
      /volleyball-motion|lifecycle-court|lifecycle-layout|participant-token/,
    )
  })

  it('keeps the static baseline free of canvas and motion runtime owners', () => {
    const markup = render()
    const source = readFileSync(
      new URL('./VoleyEvents.tsx', import.meta.url),
      'utf8',
    )

    expect(markup.match(/data-rally-stage="true"/g)).toHaveLength(1)
    expect(markup.match(/data-rally-fallback="true"/g)).toHaveLength(1)
    expect(markup.match(/class="rally-plane(?:\s|\")/g)).toHaveLength(5)
    expect(markup).not.toMatch(/<canvas|data-rally-runtime|data-rally-active/)
    expect(source).not.toMatch(
      /\b(?:gsap|three|canvas|requestAnimationFrame)\b/i,
    )
    expect(source).not.toMatch(/src\/playground|\.\.\/playground/)
  })

  it('owns exactly one eligible route-local orchestrator import shape', () => {
    const pageSource = readFileSync(
      new URL('./VoleyEvents.tsx', import.meta.url),
      'utf8',
    )
    const appSource = readFileSync(
      new URL('../App.tsx', import.meta.url),
      'utf8',
    )

    expect(
      pageSource.match(/import\('\.\.\/voleyevents\/loadRallyRuntime'\)/g),
    ).toHaveLength(1)
    expect(pageSource).not.toMatch(
      /(?:import|export)[^\n]*from ['"]\.\.\/voleyevents\//,
    )
    expect(pageSource).not.toMatch(
      /from ['"](?:gsap|three)(?:\/[^'"]+)?['"]|\.\.\/playground/,
    )
    expect(appSource).not.toMatch(
      /loadRallyRuntime|(?:from|import\()\s*['"](?:gsap|three)/,
    )
    expect(pageSource.indexOf('media.matches')).toBeLessThan(
      pageSource.indexOf("import('../voleyevents/loadRallyRuntime')"),
    )
  })

  it('preserves shared shell navigation on direct and trailing-slash routes', () => {
    for (const path of ['/voleyevents', '/voleyevents/']) {
      const markup = render(path)

      expect(markup).toContain('<nav aria-label="Primary"')
      expect(markup).toMatch(
        /<a(?=[^>]*href="\/voleyevents")(?=[^>]*aria-current="page")[^>]*>/,
      )
      expect(markup).toContain('<nav aria-label="Contact and CV"')
      expect(markup).toContain('href="mailto:tohoangviet1998@gmail.com"')
      expect(markup).toContain('href="/hoang-viet-to-cv-en.docx"')
      expect(markup).toContain('href="/hoang-viet-to-cv-cz.docx"')
      expect(markup).toContain('href="/">')
      expect(markup).toContain('href="/goal-loop"')
      expect(markup).toContain('Back to homepage')
      expect(markup).toContain('Next: Goal Loop')
      expect(markup).not.toMatch(/<canvas|data-rally-runtime/)
    }
  })

  it('keeps claims free of invented metrics, testimonials and media fixtures', () => {
    const content = JSON.stringify(VOLEYEVENTS)
    const markup = render()

    expect(content).not.toMatch(/\d|%|€|\$|£/)
    expect(content).not.toMatch(
      /customer quote|testimonial|players|payments total/i,
    )
    expect(markup).not.toMatch(/<canvas|<video|data:image|dashboard screenshot/i)
    expect(markup).not.toMatch(/<img/)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, reject, resolve }
}

function boundaryHarness(initiallyReduced = false) {
  let reduced = initiallyReduced
  const listeners = new Set<() => void>()
  const root = { dataset: {} } as HTMLElement
  const stage = {} as HTMLElement
  const media = {
    get matches() {
      return reduced
    },
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener)
    },
  } as MediaQueryList

  return {
    elements: { root, stage },
    listeners,
    media,
    root,
    setReduced(value: boolean) {
      reduced = value
      listeners.forEach((listener) => listener())
    },
  }
}

async function settleBoundary() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('VoleyEvents page runtime boundary', () => {
  it('defers importing until eligibility and accepts one fresh preference generation', async () => {
    const harness = boundaryHarness(true)
    const destroyOwner = vi.fn()
    const createOwner = vi.fn(() => {
      harness.root.dataset.rallyRuntime = 'ready'
      return { destroy: destroyOwner }
    })
    const imports = [
      deferred<{ createRallyRuntimeOwner: typeof createOwner }>(),
      deferred<{ createRallyRuntimeOwner: typeof createOwner }>(),
    ]
    let importIndex = 0
    const boundary = createVoleyEventsRuntimeBoundary({
      ...harness,
      importRuntime: vi.fn(() => imports[importIndex++].promise),
    })

    expect(importIndex).toBe(0)
    expect(harness.root.dataset.rallyRuntime).toBe('static')
    harness.setReduced(false)
    harness.setReduced(true)
    harness.setReduced(false)
    expect(importIndex).toBe(2)

    imports[1].resolve({ createRallyRuntimeOwner: createOwner })
    await settleBoundary()
    expect(createOwner).toHaveBeenCalledOnce()
    expect(harness.root.dataset.rallyRuntime).toBe('ready')

    imports[0].resolve({ createRallyRuntimeOwner: createOwner })
    await settleBoundary()
    expect(createOwner).toHaveBeenCalledOnce()
    expect(destroyOwner).not.toHaveBeenCalled()
    boundary.destroy()
  })

  it('keeps renderer surrender latched for the complete route visit', async () => {
    const harness = boundaryHarness()
    let surrender!: () => void
    const importRuntime = vi.fn(async () => ({
      createRallyRuntimeOwner(options: { onSurrender?: () => void }) {
        surrender = options.onSurrender ?? (() => undefined)
        harness.root.dataset.rallyRuntime = 'ready'
        return { destroy: vi.fn() }
      },
    }))
    const boundary = createVoleyEventsRuntimeBoundary({
      ...harness,
      importRuntime,
    })

    await settleBoundary()
    surrender()
    expect(harness.root.dataset.rallyRuntime).toBe('static')
    harness.setReduced(true)
    harness.setReduced(false)
    await settleBoundary()
    expect(importRuntime).toHaveBeenCalledOnce()
    expect(harness.root.dataset.rallyRuntime).toBe('static')
    boundary.destroy()
  })

  it('contains current, canceled, and stale import failures', async () => {
    const currentHarness = boundaryHarness()
    const currentFailure = deferred<never>()
    const current = createVoleyEventsRuntimeBoundary({
      ...currentHarness,
      importRuntime: () => currentFailure.promise,
    })
    currentFailure.reject(new Error('current import failed'))
    await settleBoundary()
    expect(currentHarness.root.dataset.rallyRuntime).toBe('static')
    current.destroy()

    const canceledHarness = boundaryHarness()
    const canceledFailure = deferred<never>()
    const canceled = createVoleyEventsRuntimeBoundary({
      ...canceledHarness,
      importRuntime: () => canceledFailure.promise,
    })
    canceled.destroy()
    canceledFailure.reject(new Error('canceled import failed'))
    await settleBoundary()
    expect(canceledHarness.root.dataset.rallyRuntime).toBeUndefined()

    const staleHarness = boundaryHarness()
    const createStaleOwner = vi.fn(() => ({ destroy: vi.fn() }))
    const staleImports = [
      deferred<{
        createRallyRuntimeOwner: () => { destroy(): void }
      }>(),
      deferred<{
        createRallyRuntimeOwner: () => { destroy(): void }
      }>(),
    ]
    let importIndex = 0
    const stale = createVoleyEventsRuntimeBoundary({
      ...staleHarness,
      importRuntime: () => staleImports[importIndex++].promise,
    })
    staleHarness.setReduced(true)
    staleHarness.setReduced(false)
    staleImports[1].resolve({
      createRallyRuntimeOwner() {
        staleHarness.root.dataset.rallyRuntime = 'ready'
        return createStaleOwner()
      },
    })
    await settleBoundary()
    staleImports[0].reject(new Error('old import failed'))
    await settleBoundary()
    expect(staleHarness.root.dataset.rallyRuntime).toBe('ready')
    stale.destroy()
  })

  it('contains owner construction failure and destroys a live owner once', async () => {
    const failedHarness = boundaryHarness()
    const failed = createVoleyEventsRuntimeBoundary({
      ...failedHarness,
      importRuntime: async () => ({
        createRallyRuntimeOwner() {
          throw new Error('owner failed')
        },
      }),
    })
    await settleBoundary()
    expect(failedHarness.root.dataset.rallyRuntime).toBe('static')
    failed.destroy()

    const liveHarness = boundaryHarness()
    const destroyOwner = vi.fn()
    const live = createVoleyEventsRuntimeBoundary({
      ...liveHarness,
      importRuntime: async () => ({
        createRallyRuntimeOwner() {
          liveHarness.root.dataset.rallyRuntime = 'ready'
          return { destroy: destroyOwner }
        },
      }),
    })
    await settleBoundary()
    liveHarness.setReduced(true)
    liveHarness.setReduced(true)
    live.destroy()
    expect(destroyOwner).toHaveBeenCalledOnce()
    expect(liveHarness.listeners.size).toBe(0)
  })

  it('keeps StrictMode-style stale fulfillment from constructing an owner', async () => {
    const harness = boundaryHarness()
    const createOwner = vi.fn(() => ({ destroy: vi.fn() }))
    const firstImport = deferred<{
      createRallyRuntimeOwner: typeof createOwner
    }>()
    const first = createVoleyEventsRuntimeBoundary({
      ...harness,
      importRuntime: () => firstImport.promise,
    })
    first.destroy()
    const second = createVoleyEventsRuntimeBoundary({
      ...harness,
      importRuntime: async () => ({ createRallyRuntimeOwner: createOwner }),
    })

    await settleBoundary()
    firstImport.resolve({ createRallyRuntimeOwner: createOwner })
    await settleBoundary()
    expect(createOwner).toHaveBeenCalledOnce()
    second.destroy()
    expect(harness.listeners.size).toBe(0)
  })
})
