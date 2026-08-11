import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { subscribeToRouteChanges } from '../content/routes'
import {
  createRelayPlayhead,
  getRelayFragmentAction,
  measureRelayGeometry,
  type RelayFragmentClick,
} from './relayPlayhead'
import type { RelayMotionFacade } from './loadRelayRuntime'

function measuredElement(top: number, id = '') {
  return {
    id,
    getBoundingClientRect: () => ({ top }),
  } as HTMLElement
}

function fragmentClick(
  href: string,
  overrides: Partial<RelayFragmentClick> = {},
): RelayFragmentClick {
  const anchor = {
    download: '',
    hasAttribute(name: string) {
      return name === 'download' && Boolean(this.download)
    },
    getAttribute(name: string) {
      if (name === 'href') return href
      if (name === 'data-relay-action') return 'next'
      if (name === 'target') return ''
      return null
    },
  } as HTMLAnchorElement

  return {
    altKey: false,
    anchor,
    button: 0,
    ctrlKey: false,
    defaultPrevented: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  }
}

describe('relay playhead geometry', () => {
  it('uses one exact nonzero-origin interval in both directions', () => {
    const geometry = measureRelayGeometry({
      beatElements: [
        measuredElement(210.25, 'relay-input'),
        measuredElement(370.75, 'relay-fold'),
        measuredElement(430.875, 'relay-feedback'),
        measuredElement(970.5, 'relay-closed'),
      ],
      beatsTop: 210.25,
      documentMaximumScroll: 760.5,
      scrollY: 100,
    })

    expect(geometry.origin).toBe(310.25)
    expect(geometry.end).toBe(760.5)
    expect(geometry.resolver.beats.map((beat) => beat.start)).toEqual([
      0, 160.5, 220.625, 760.25,
    ])
    expect(geometry.absoluteSeekTarget('relay-fold')).toBe(470.75)
    expect(geometry.absoluteSeekTarget('relay-closed')).toBe(760.5)
    expect(geometry.classifyDocumentScroll(531)).toBe('relay-feedback')
    expect(geometry.classifyDocumentScroll(470.74999999999994)).toBe(
      'relay-input',
    )
  })
})

describe('relay playhead source closure', () => {
  const source = readFileSync(
    new URL('./relayPlayhead.ts', import.meta.url),
    'utf8',
  )

  it('owns one real scrub trigger without timeline control or input hijacking', () => {
    expect(source.match(/scrub:\s*true/g)).toHaveLength(1)
    expect(source).not.toMatch(
      /timeline\.(?:seek|progress|time|totalProgress)\s*\(/,
    )
    expect(source).not.toMatch(
      /addEventListener\(['"](?:wheel|touchstart|touchmove|keydown)['"]/,
    )
    expect(source).not.toMatch(/\bpin\s*:|ScrollSmoother|scrollToPlugin|killAll/)
  })

  it('loads motion only through the committed lazy runtime boundary', () => {
    expect(source).toContain("from './loadRelayRuntime'")
    expect(source).not.toMatch(/from ['"]gsap(?:\/[^'"]*)?['"]/)
  })
})

describe('relay fragment contract', () => {
  it('accepts only same-document primary unmodified fragment controls', () => {
    const current = 'https://example.test/playground?mode=one#relay-input'
    const accepted = getRelayFragmentAction(
      fragmentClick('#relay-fold'),
      current,
      (id) => id === 'relay-fold',
    )

    expect(accepted).toMatchObject({
      action: 'next',
      targetId: 'relay-fold',
    })
    expect(accepted?.url.href).toBe(
      'https://example.test/playground?mode=one#relay-fold',
    )

    for (const click of [
      fragmentClick('#relay-fold', { button: 1 }),
      fragmentClick('#relay-fold', { metaKey: true }),
      fragmentClick('#relay-fold', { ctrlKey: true }),
      fragmentClick('#relay-fold', { shiftKey: true }),
      fragmentClick('#relay-fold', { altKey: true }),
      fragmentClick('#relay-fold', { defaultPrevented: true }),
      fragmentClick('https://elsewhere.test/playground#relay-fold'),
      fragmentClick('/goal-loop#relay-fold'),
    ]) {
      expect(
        getRelayFragmentAction(click, current, () => true),
      ).toBeNull()
    }
  })

  it('rejects target, download, missing destinations, and unknown actions', () => {
    const current = 'https://example.test/playground'
    const target = fragmentClick('#relay-fold')
    vi.spyOn(target.anchor, 'getAttribute').mockImplementation((name) => {
      if (name === 'href') return '#relay-fold'
      if (name === 'target') return '_blank'
      if (name === 'data-relay-action') return 'next'
      return null
    })
    expect(getRelayFragmentAction(target, current, () => true)).toBeNull()

    const download = fragmentClick('#relay-fold')
    Object.defineProperty(download.anchor, 'download', { value: 'relay.svg' })
    expect(getRelayFragmentAction(download, current, () => true)).toBeNull()
    expect(
      getRelayFragmentAction(
        fragmentClick('#missing'),
        current,
        () => false,
      ),
    ).toBeNull()
  })

  it('keeps repeated destinations valid for FIFO announcements/history', () => {
    const current = 'https://example.test/playground#relay-fold'
    const first = getRelayFragmentAction(
      fragmentClick('#relay-fold'),
      current,
      () => true,
    )
    const second = getRelayFragmentAction(
      fragmentClick('#relay-fold'),
      current,
      () => true,
    )

    const observableAction = {
      action: 'next',
      targetId: 'relay-fold',
    } as const
    expect(first).toMatchObject(observableAction)
    expect(second).toMatchObject(observableAction)
    expect(first?.url.href).toBe(current)
    expect(second?.url.href).toBe(current)
  })
})

function integrationHarness(
  reduced = false,
  applyScrollCoordinate = (value: number) => value,
) {
  let scrollY = 0
  let mediaMatches = reduced
  let nextFrame = 1
  let nextTimer = 1
  const windowListeners = new Map<string, Set<(event: Event) => void>>()
  const routeListeners = new Map<string, Set<(event: Event) => void>>()
  const mediaListeners = new Set<() => void>()
  const frames = new Map<number, FrameRequestCallback>()
  const timers = new Map<number, () => void>()
  const scrollWrites: number[] = []
  const announcements: string[] = []
  const historyWrites: string[] = []
  const historyEntries = ['https://example.test/playground']
  let historyIndex = 0
  const rootClasses = new Set(['foreign-root'])
  let activeElement: Element | null = null
  let latestAnchor: HTMLAnchorElement | null = null
  let deferScrollEvents = false
  let deferredScrollEvent = false
  const beatDocuments = [100, 260, 320, 900]
  const beatIds = [
    'relay-input',
    'relay-fold',
    'relay-feedback',
    'relay-closed',
  ]
  const beats = beatIds.map((id, index) => ({
    id,
    getBoundingClientRect: () => ({ top: beatDocuments[index] - scrollY }),
  })) as HTMLElement[]
  const signals = beatIds.map(() => ({} as SVGElement))
  const route = {
    dataset: { foreign: 'preserved' } as DOMStringMap,
    addEventListener(type: string, listener: (event: Event) => void) {
      const listeners = routeListeners.get(type) ?? new Set()
      listeners.add(listener)
      routeListeners.set(type, listeners)
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      routeListeners.get(type)?.delete(listener)
    },
    contains: () => true,
  } as unknown as HTMLElement
  const stage = {
    querySelectorAll: () => signals,
  } as unknown as HTMLElement
  const beatRoot = {
    getBoundingClientRect: () => ({ top: beatDocuments[0] - scrollY }),
    querySelectorAll: () => beats,
  } as unknown as HTMLElement
  const status = { textContent: '' } as HTMLElement
  let liveText = ''
  const liveRegion = {
    get textContent() {
      return liveText
    },
    set textContent(value: string) {
      liveText = value
      announcements.push(value)
    },
    getAttribute(name: string) {
      if (name === 'aria-live') return 'polite'
      if (name === 'aria-atomic') return 'true'
      return null
    },
  } as HTMLElement
  const media = {
    get matches() {
      return mediaMatches
    },
    addEventListener(_type: string, listener: () => void) {
      mediaListeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      mediaListeners.delete(listener)
    },
  } as MediaQueryList
  const location = {
    href: 'https://example.test/playground',
    get hash() {
      return new URL(this.href).hash
    },
    get pathname() {
      return new URL(this.href).pathname
    },
    get search() {
      return new URL(this.href).search
    },
  }

  function dispatchWindow(type: string) {
    windowListeners.get(type)?.forEach((listener) => listener(new Event(type)))
  }

  const win = {
    get scrollY() {
      return scrollY
    },
    innerWidth: 1000,
    innerHeight: 200,
    location,
    history: {
      pushState(_state: unknown, _title: string, url: string) {
        historyWrites.push(url)
        location.href = new URL(url, location.href).href
        historyEntries.splice(historyIndex + 1)
        historyEntries.push(location.href)
        historyIndex = historyEntries.length - 1
      },
    },
    matchMedia: () => media,
    addEventListener(type: string, listener: (event: Event) => void) {
      const listeners = windowListeners.get(type) ?? new Set()
      listeners.add(listener)
      windowListeners.set(type, listeners)
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      windowListeners.get(type)?.delete(listener)
    },
    requestAnimationFrame(callback: FrameRequestCallback) {
      const id = nextFrame++
      frames.set(id, callback)
      return id
    },
    cancelAnimationFrame(id: number) {
      frames.delete(id)
    },
    setTimeout(callback: () => void) {
      const id = nextTimer++
      timers.set(id, callback)
      return id
    },
    clearTimeout(id: number) {
      timers.delete(id)
    },
    scrollTo(options: ScrollToOptions) {
      scrollY = applyScrollCoordinate(Number(options.top))
      scrollWrites.push(scrollY)
      if (deferScrollEvents) {
        deferredScrollEvent = true
      } else {
        dispatchWindow('scroll')
      }
    },
  } as unknown as Window
  const doc = {
    body: { scrollHeight: 1000 },
    get activeElement() {
      return activeElement
    },
    documentElement: {
      scrollHeight: 1000,
      classList: {
        add: (token: string) => rootClasses.add(token),
        contains: (token: string) => rootClasses.has(token),
        remove: (token: string) => rootClasses.delete(token),
      },
    },
    getElementById: (id: string) =>
      beatIds.includes(id) ? ({} as HTMLElement) : null,
  } as unknown as Document

  function anchor(href: string, action = 'next') {
    return {
      download: '',
      focus() {
        activeElement = this as unknown as Element
      },
      hasAttribute(_name: string) {
        return false
      },
      getAttribute(name: string) {
        if (name === 'href') return href
        if (name === 'data-relay-action') return action
        if (name === 'target') return ''
        return null
      },
    } as HTMLAnchorElement
  }

  return {
    document: doc,
    elements: { route, stage, beats: beatRoot, status, liveRegion },
    window: win,
    announcements,
    historyWrites,
    rootClasses,
    scrollWrites,
    click(href = '#relay-fold', action = 'next') {
      const preventDefault = vi.fn()
      const control = anchor(href, action)
      latestAnchor = control
      activeElement = control
      const event = {
        altKey: false,
        button: 0,
        ctrlKey: false,
        defaultPrevented: false,
        metaKey: false,
        shiftKey: false,
        target: { closest: () => control },
        preventDefault,
      } as unknown as MouseEvent
      routeListeners.get('click')?.forEach((listener) =>
        listener(event as unknown as Event),
      )
      return preventDefault
    },
    activeElement: () => activeElement,
    latestAnchor: () => latestAnchor,
    drainAnnouncements() {
      while (timers.size > 0) {
        const [id, task] = timers.entries().next().value as [number, () => void]
        timers.delete(id)
        task()
      }
    },
    runFrame() {
      const entry = frames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (!entry) return false
      frames.delete(entry[0])
      entry[1](0)
      return true
    },
    setHumanScroll(value: number) {
      scrollY = value
      dispatchWindow('scroll')
    },
    resize(
      innerWidth: number,
      innerHeight: number,
      nextBeatDocuments: readonly number[],
    ) {
      ;(win as unknown as { innerWidth: number }).innerWidth = innerWidth
      ;(win as unknown as { innerHeight: number }).innerHeight = innerHeight
      beatDocuments.splice(0, beatDocuments.length, ...nextBeatDocuments)
      dispatchWindow('resize')
    },
    deferScrollDelivery(value: boolean) {
      deferScrollEvents = value
    },
    flushScrollDelivery() {
      if (!deferredScrollEvent) return false
      deferredScrollEvent = false
      dispatchWindow('scroll')
      return true
    },
    traverseHistory(delta: -1 | 1) {
      const nextIndex = historyIndex + delta
      if (nextIndex < 0 || nextIndex >= historyEntries.length) return false
      historyIndex = nextIndex
      location.href = historyEntries[historyIndex]
      const id = new URL(location.href).hash.slice(1)
      const beatIndex = beatIds.indexOf(id)
      if (beatIndex >= 0) scrollY = beatDocuments[beatIndex]
      dispatchWindow('popstate')
      dispatchWindow('scroll')
      return true
    },
    setReduced(value: boolean) {
      mediaMatches = value
      mediaListeners.forEach((listener) => listener())
    },
    listenerCount() {
      return [...windowListeners.values()].reduce(
        (total, listeners) => total + listeners.size,
        mediaListeners.size +
          [...routeListeners.values()].reduce(
            (total, listeners) => total + listeners.size,
            0,
          ),
      )
    },
    pendingFrames: () => frames.size,
    pendingTimers: () => timers.size,
  }
}

function motionDouble() {
  const timelineOptions: Array<Record<string, unknown>> = []
  const scrollTweens: Array<{
    readonly kill: ReturnType<typeof vi.fn>
    readonly target: { y: number }
    readonly vars: Record<string, unknown>
  }> = []
  const revert = vi.fn()
  const refresh = vi.fn()
  const seek = vi.fn()
  const progress = vi.fn()

  const motion = {
    gsap: {
      context(callback: () => void) {
        callback()
        return { revert }
      },
      timeline(options: Record<string, unknown>) {
        timelineOptions.push(options)
        const timeline = {
          fromTo: vi.fn(() => timeline),
          progress,
          seek,
          set: vi.fn(() => timeline),
          to: vi.fn(() => timeline),
        }
        return timeline
      },
      to(target: { y: number }, vars: Record<string, unknown>) {
        const tween = { kill: vi.fn(), target, vars }
        scrollTweens.push(tween)
        return tween
      },
    },
    ScrollTrigger: { refresh },
  } as unknown as RelayMotionFacade

  return {
    motion,
    progress,
    refresh,
    revert,
    scrollTweens,
    seek,
    timelineOptions,
  }
}

async function settleLoad() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('relay playhead lifecycle integration', () => {
  it('keeps reduced motion static without requesting motion', () => {
    const harness = integrationHarness(true)
    const importMotion = vi.fn(async () => motionDouble().motion)
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion,
    })

    expect(importMotion).not.toHaveBeenCalled()
    expect(harness.elements.route.dataset.relayRuntime).toBe('static')
    const prevented = harness.click()
    harness.drainAnnouncements()
    expect(prevented).toHaveBeenCalledTimes(1)
    expect(harness.historyWrites).toEqual(['/playground#relay-fold'])
    expect(harness.scrollWrites).toEqual([260])
    expect(harness.announcements).toEqual(['', 'Next beat: FOLD'])

    playhead.destroy()
    playhead.destroy()
    expect(harness.listenerCount()).toBe(0)
    expect(harness.rootClasses).toEqual(new Set(['foreign-root']))
  })

  it('maps one scrub runtime to native writes and kills interruption once', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: vi.fn(async () => runtime.motion),
    })
    await settleLoad()

    expect(runtime.timelineOptions).toHaveLength(1)
    expect(runtime.timelineOptions[0].scrollTrigger).toMatchObject({
      start: 100,
      end: 800,
      scrub: true,
    })
    expect(harness.runFrame()).toBe(true)
    expect(runtime.refresh).not.toHaveBeenCalled()
    expect(harness.runFrame()).toBe(true)
    expect(runtime.refresh).toHaveBeenCalledTimes(1)

    const prevented = harness.click()
    expect(prevented).toHaveBeenCalledTimes(1)
    expect(harness.historyWrites).toEqual(['/playground#relay-fold'])
    const tween = runtime.scrollTweens[0]
    for (const position of [100, 160, 220]) {
      tween.target.y = position
      ;(tween.vars.onUpdate as () => void)()
    }
    expect(harness.scrollWrites).toEqual([100, 160, 220])

    harness.setHumanScroll(160)
    expect(tween.kill).toHaveBeenCalledTimes(1)
    tween.target.y = 500
    ;(tween.vars.onUpdate as () => void)()
    expect(harness.scrollWrites).toEqual([100, 160, 220])

    // A repeated current destination still records history/announcement but
    // needs no tween; rapid replacements kill only their own prior tween.
    harness.setHumanScroll(260)
    harness.click()
    expect(runtime.scrollTweens).toHaveLength(1)
    harness.click('#relay-feedback')
    harness.click('#relay-feedback')
    expect(runtime.scrollTweens).toHaveLength(3)
    expect(runtime.scrollTweens[1].kill).toHaveBeenCalledTimes(1)
    expect(harness.historyWrites).toEqual([
      '/playground#relay-fold',
      '/playground#relay-fold',
      '/playground#relay-feedback',
      '/playground#relay-feedback',
    ])

    playhead.destroy()
    expect(runtime.revert).toHaveBeenCalledTimes(1)
    expect(runtime.scrollTweens[2].kill).toHaveBeenCalledTimes(1)
    expect(harness.listenerCount()).toBe(0)
    expect(harness.pendingFrames()).toBe(0)
    expect(harness.pendingTimers()).toBe(0)
  })

  it('defers the bounded refresh until native scroll and a control seek are idle', async () => {
    const scrollingHarness = integrationHarness()
    const scrollingRuntime = motionDouble()
    const scrollingPlayhead = createRelayPlayhead({
      ...scrollingHarness,
      importMotion: vi.fn(async () => scrollingRuntime.motion),
    })
    await settleLoad()

    scrollingHarness.setHumanScroll(120)
    expect(scrollingHarness.runFrame()).toBe(true)
    expect(scrollingRuntime.refresh).not.toHaveBeenCalled()
    scrollingHarness.setHumanScroll(140)
    expect(scrollingHarness.runFrame()).toBe(true)
    expect(scrollingRuntime.refresh).not.toHaveBeenCalled()
    expect(scrollingHarness.runFrame()).toBe(true)
    expect(scrollingRuntime.refresh).toHaveBeenCalledTimes(1)
    expect(scrollingHarness.runFrame()).toBe(false)
    scrollingPlayhead.destroy()

    const seekingHarness = integrationHarness()
    const seekingRuntime = motionDouble()
    const seekingPlayhead = createRelayPlayhead({
      ...seekingHarness,
      importMotion: vi.fn(async () => seekingRuntime.motion),
    })
    await settleLoad()

    seekingHarness.click('#relay-fold')
    const tween = seekingRuntime.scrollTweens[0]
    expect(seekingHarness.runFrame()).toBe(true)
    expect(seekingRuntime.refresh).not.toHaveBeenCalled()
    tween.target.y = 160
    ;(tween.vars.onUpdate as () => void)()
    expect(seekingHarness.runFrame()).toBe(true)
    expect(seekingRuntime.refresh).not.toHaveBeenCalled()
    ;(tween.vars.onComplete as () => void)()
    expect(seekingHarness.runFrame()).toBe(true)
    expect(seekingRuntime.refresh).not.toHaveBeenCalled()
    expect(seekingHarness.runFrame()).toBe(true)
    expect(seekingRuntime.refresh).toHaveBeenCalledTimes(1)
    expect(seekingHarness.runFrame()).toBe(false)

    seekingPlayhead.destroy()
  })

  it('rebuilds one route runtime from settled resize geometry', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    const importMotion = vi.fn(async () => runtime.motion)
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion,
    })
    await settleLoad()

    expect(runtime.timelineOptions[0].scrollTrigger).toMatchObject({
      start: 100,
      end: 800,
    })
    harness.resize(390, 300, [120, 310, 510, 980])
    expect(harness.runFrame()).toBe(true)
    expect(harness.runFrame()).toBe(true)
    expect(importMotion).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(runtime.timelineOptions).toHaveLength(2))

    expect(runtime.revert).toHaveBeenCalledTimes(1)
    expect(runtime.timelineOptions[1].scrollTrigger).toMatchObject({
      start: 120,
      end: 700,
    })

    playhead.destroy()
    expect(runtime.revert).toHaveBeenCalledTimes(2)
  })

  it('ignores mobile height churn and a queued resize after reduced motion', async () => {
    const heightHarness = integrationHarness()
    const heightRuntime = motionDouble()
    const heightImport = vi.fn(async () => heightRuntime.motion)
    const heightPlayhead = createRelayPlayhead({
      ...heightHarness,
      importMotion: heightImport,
    })
    await settleLoad()
    while (heightHarness.runFrame()) {}

    heightHarness.resize(1000, 260, [100, 260, 320, 900])
    expect(heightHarness.runFrame()).toBe(false)
    expect(heightImport).toHaveBeenCalledTimes(1)
    expect(heightRuntime.revert).not.toHaveBeenCalled()
    heightPlayhead.destroy()

    const reducedHarness = integrationHarness()
    const reducedRuntime = motionDouble()
    const reducedImport = vi.fn(async () => reducedRuntime.motion)
    const reducedPlayhead = createRelayPlayhead({
      ...reducedHarness,
      importMotion: reducedImport,
    })
    await settleLoad()
    reducedHarness.resize(390, 300, [120, 310, 510, 980])
    reducedHarness.setReduced(true)
    while (reducedHarness.runFrame()) {}
    await settleLoad()

    expect(reducedImport).toHaveBeenCalledTimes(1)
    expect(reducedRuntime.revert).toHaveBeenCalledTimes(1)
    expect(reducedHarness.elements.route.dataset.relayRuntime).toBe('static')
    reducedPlayhead.destroy()
  })

  it('tracks geometry width across reduced-motion resize round trips', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: vi.fn(async () => runtime.motion),
    })
    await settleLoad()

    harness.setReduced(true)
    harness.resize(390, 300, [120, 310, 510, 980])
    harness.setReduced(false)
    await vi.waitFor(() => expect(runtime.timelineOptions).toHaveLength(2))
    expect(runtime.timelineOptions[1].scrollTrigger).toMatchObject({
      start: 120,
      end: 700,
    })

    harness.resize(1000, 200, [100, 260, 320, 900])
    while (runtime.timelineOptions.length < 3 && harness.runFrame()) {}
    await vi.waitFor(() => expect(runtime.timelineOptions).toHaveLength(3))
    expect(runtime.timelineOptions[2].scrollTrigger).toMatchObject({
      start: 100,
      end: 800,
    })

    playhead.destroy()
  })

  it('keeps a replacement seek alive across a coalesced prior scroll event', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: vi.fn(async () => runtime.motion),
    })
    await settleLoad()

    harness.deferScrollDelivery(true)
    harness.click('#relay-fold')
    const first = runtime.scrollTweens[0]
    first.target.y = 160
    ;(first.vars.onUpdate as () => void)()

    harness.click('#relay-feedback')
    const replacement = runtime.scrollTweens[1]
    expect(first.kill).toHaveBeenCalledTimes(1)
    first.target.y = 999
    ;(first.vars.onUpdate as () => void)()
    ;(first.vars.onComplete as () => void)()
    expect(harness.scrollWrites).toEqual([160])
    expect(harness.flushScrollDelivery()).toBe(true)
    expect(replacement.kill).not.toHaveBeenCalled()

    replacement.target.y = 220
    ;(replacement.vars.onUpdate as () => void)()
    expect(harness.flushScrollDelivery()).toBe(true)
    expect(harness.scrollWrites).toEqual([160, 220])
    expect(replacement.kill).not.toHaveBeenCalled()

    harness.setHumanScroll(160)
    expect(replacement.kill).toHaveBeenCalledTimes(1)
    harness.setHumanScroll(150)
    expect(replacement.kill).toHaveBeenCalledTimes(1)

    playhead.destroy()
  })

  it('owns the exact coordinate applied after browser scroll quantization', async () => {
    const harness = integrationHarness(false, Math.round)
    const runtime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: vi.fn(async () => runtime.motion),
    })
    await settleLoad()

    harness.deferScrollDelivery(true)
    harness.click('#relay-fold')
    const tween = runtime.scrollTweens[0]
    tween.target.y = 160.4
    ;(tween.vars.onUpdate as () => void)()

    expect(harness.scrollWrites).toEqual([160])
    expect(harness.flushScrollDelivery()).toBe(true)
    expect(tween.kill).not.toHaveBeenCalled()

    playhead.destroy()
  })

  it('rejects stale callbacks after a completed seek is replaced', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: vi.fn(async () => runtime.motion),
    })
    await settleLoad()

    harness.click('#relay-fold')
    const completed = runtime.scrollTweens[0]
    completed.target.y = 260
    ;(completed.vars.onUpdate as () => void)()
    ;(completed.vars.onComplete as () => void)()

    harness.click('#relay-feedback')
    const replacement = runtime.scrollTweens[1]
    completed.target.y = 700
    ;(completed.vars.onUpdate as () => void)()
    ;(completed.vars.onComplete as () => void)()

    expect(harness.scrollWrites).toEqual([260])
    expect(replacement.kill).not.toHaveBeenCalled()

    replacement.target.y = 320
    ;(replacement.vars.onUpdate as () => void)()
    expect(harness.scrollWrites).toEqual([260, 320])

    playhead.destroy()
  })

  it('runs replay through native scroll without timeline control', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: vi.fn(async () => runtime.motion),
    })
    await settleLoad()

    harness.setHumanScroll(320)
    const prevented = harness.click('#relay-input', 'replay')
    const replay = runtime.scrollTweens[0]
    replay.target.y = 100
    ;(replay.vars.onUpdate as () => void)()

    expect(prevented).toHaveBeenCalledTimes(1)
    expect(harness.historyWrites).toEqual(['/playground#relay-input'])
    expect(harness.scrollWrites).toEqual([100])
    expect(runtime.seek).not.toHaveBeenCalled()
    expect(runtime.progress).not.toHaveBeenCalled()

    playhead.destroy()
  })

  it('keeps scrub silent, repeats FIFO actions, focus, and native history traversal', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: vi.fn(async () => runtime.motion),
    })
    const traversedRoutes: string[] = []
    const unsubscribeRouteChanges = subscribeToRouteChanges(
      harness.window,
      (route) => traversedRoutes.push(route.path),
    )
    await settleLoad()

    harness.setHumanScroll(160)
    harness.setHumanScroll(260)
    harness.drainAnnouncements()
    expect(harness.announcements).toEqual([])
    expect(harness.pendingTimers()).toBe(0)

    harness.click('#relay-fold')
    const firstFocusedAnchor = harness.latestAnchor()
    expect(harness.activeElement()).toBe(firstFocusedAnchor)
    harness.click('#relay-fold')
    expect(runtime.scrollTweens).toHaveLength(0)
    expect(harness.scrollWrites).toEqual([])

    harness.drainAnnouncements()
    expect(harness.announcements).toEqual([
      '',
      'Next beat: FOLD',
      '',
      'Next beat: FOLD',
    ])

    harness.click('#relay-feedback')
    const focusedAnchor = harness.latestAnchor()
    expect(harness.activeElement()).toBe(focusedAnchor)
    const tween = runtime.scrollTweens[0]
    tween.target.y = 320
    ;(tween.vars.onUpdate as () => void)()
    ;(tween.vars.onComplete as () => void)()
    harness.drainAnnouncements()
    const announcementsAfterActions = [...harness.announcements]
    expect(announcementsAfterActions).toEqual([
      '',
      'Next beat: FOLD',
      '',
      'Next beat: FOLD',
      '',
      'Next beat: FEEDBACK',
    ])
    expect(harness.historyWrites).toEqual([
      '/playground#relay-fold',
      '/playground#relay-fold',
      '/playground#relay-feedback',
    ])

    expect(harness.traverseHistory(-1)).toBe(true)
    expect(new URL(harness.window.location.href).hash).toBe('#relay-fold')
    expect(harness.elements.route.dataset.relayBeat).toBe('relay-fold')
    expect(harness.traverseHistory(1)).toBe(true)
    expect(new URL(harness.window.location.href).hash).toBe(
      '#relay-feedback',
    )
    expect(harness.elements.route.dataset.relayBeat).toBe('relay-feedback')
    expect(harness.activeElement()).toBe(focusedAnchor)
    expect(harness.historyWrites).toHaveLength(3)
    expect(harness.announcements).toEqual(announcementsAfterActions)
    expect(traversedRoutes).toEqual(['/playground', '/playground'])

    unsubscribeRouteChanges()
    playhead.destroy()
    expect(harness.listenerCount()).toBe(0)
  })

  it('invalidates pending loads and contains a current loader failure', async () => {
    const harness = integrationHarness()
    const resolves: Array<(motion: RelayMotionFacade) => void> = []
    const staleRuntime = motionDouble()
    const currentRuntime = motionDouble()
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: () =>
        new Promise<RelayMotionFacade>((resolve) => resolves.push(resolve)),
    })

    harness.setReduced(true)
    harness.setReduced(false)
    expect(resolves).toHaveLength(2)
    resolves[0](staleRuntime.motion)
    await settleLoad()
    expect(staleRuntime.timelineOptions).toHaveLength(0)
    resolves[1](currentRuntime.motion)
    await settleLoad()
    expect(currentRuntime.timelineOptions).toHaveLength(1)
    playhead.destroy()
    expect(currentRuntime.revert).toHaveBeenCalledTimes(1)

    const failedHarness = integrationHarness()
    const failed = createRelayPlayhead({
      ...failedHarness,
      importMotion: async () => {
        throw new Error('network unavailable')
      },
    })
    await settleLoad()
    expect(failedHarness.elements.route.dataset.relayRuntime).toBe('static')
    failed.destroy()
  })

  it('does not construct a runtime when destroyed before lazy load resolves', async () => {
    const harness = integrationHarness()
    const runtime = motionDouble()
    let resolveMotion!: (motion: RelayMotionFacade) => void
    const playhead = createRelayPlayhead({
      ...harness,
      importMotion: () =>
        new Promise<RelayMotionFacade>((resolve) => {
          resolveMotion = resolve
        }),
    })

    playhead.destroy()
    resolveMotion(runtime.motion)
    await settleLoad()

    expect(runtime.timelineOptions).toHaveLength(0)
    expect(runtime.revert).not.toHaveBeenCalled()
    expect(harness.listenerCount()).toBe(0)
    expect(harness.pendingFrames()).toBe(0)
    expect(harness.pendingTimers()).toBe(0)
    expect(harness.rootClasses).toEqual(new Set(['foreign-root']))
    expect(harness.elements.route.dataset.relayRuntime).toBeUndefined()
    expect(harness.elements.route.dataset.relayBeat).toBeUndefined()
  })
})
