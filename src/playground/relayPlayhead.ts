import {
  createRelayRuntimeGate,
  loadRelayRuntime,
  type RelayMotionFacade,
} from './loadRelayRuntime'
import {
  createRelayAnnouncer,
  RELAY_BEAT_TITLES,
  type RelayAnnouncementAction,
  type RelayBeatId,
} from './relayAnnouncer'
import { resolveRelayBeats, type RelayBeatResolver } from './relayBeats'
import {
  beginAuthoredSeek,
  createScrollOwnershipLedger,
  observeScrollPosition,
  recordAuthoredWrite,
  type ScrollOwnershipLedger,
} from './scrollOwnership'
import { installDocumentScrollBehavior } from './documentScrollBehavior'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const BEAT_SELECTOR = '.relay-beat[id]'
const CONTROL_SELECTOR = 'a.relay-beat-link[href]'

export interface RelayPlayheadElements {
  readonly route: HTMLElement
  readonly stage: HTMLElement
  readonly beats: HTMLElement
  readonly status: HTMLElement
  readonly liveRegion: HTMLElement
}

export interface RelayFragmentClick {
  readonly altKey: boolean
  readonly anchor: HTMLAnchorElement
  readonly button: number
  readonly ctrlKey: boolean
  readonly defaultPrevented: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

export interface RelayFragmentAction {
  readonly action: RelayAnnouncementAction
  readonly anchor: HTMLAnchorElement
  readonly targetId: RelayBeatId
  readonly url: URL
}

export interface RelayGeometry {
  readonly origin: number
  readonly end: number
  readonly resolver: RelayBeatResolver
  absoluteSeekTarget(id: string): number
  classifyDocumentScroll(scrollY: number): string
}

export interface RelayGeometryMeasurements {
  readonly beatElements: readonly HTMLElement[]
  readonly beatsTop: number
  readonly documentMaximumScroll: number
  readonly scrollY: number
}

export interface RelayPlayheadOptions {
  readonly elements: RelayPlayheadElements
  readonly document?: Document
  readonly window?: Window
  /** Test seam; production always uses the registered lazy facade loader. */
  readonly importMotion?: () => Promise<RelayMotionFacade>
}

export interface RelayPlayhead {
  destroy(): void
}

interface RouteMotionRuntime {
  scrollToBeat(id: RelayBeatId): void
  alignToBeat(id: RelayBeatId): void
  isSeeking(): boolean
  classifyDocumentScroll(scrollY: number): string
  destroy(): void
}

function finiteCoordinate(value: number) {
  return Number.isFinite(value) ? value : 0
}

function relayBeatId(value: string): value is RelayBeatId {
  return Object.hasOwn(RELAY_BEAT_TITLES, value)
}

function relayAction(value: string | null): RelayAnnouncementAction | null {
  if (value === 'previous' || value === 'next' || value === 'replay') {
    return value
  }
  return null
}

/**
 * Converts viewport measurements into one route interval. Beat offsets remain
 * unrounded; native targets and ScrollTrigger share the same absolute bounds.
 */
export function measureRelayGeometry(
  measurements: RelayGeometryMeasurements,
): RelayGeometry {
  const scrollY = finiteCoordinate(measurements.scrollY)
  const origin = finiteCoordinate(measurements.beatsTop) + scrollY
  const end = Math.max(
    origin,
    finiteCoordinate(measurements.documentMaximumScroll),
  )
  const resolver = resolveRelayBeats(
    measurements.beatElements.map((beat) => ({
      id: beat.id,
      top: finiteCoordinate(beat.getBoundingClientRect().top) -
        finiteCoordinate(measurements.beatsTop),
    })),
    end - origin,
  )

  return Object.freeze({
    origin,
    end,
    resolver,
    absoluteSeekTarget(id: string) {
      return origin + resolver.seekTargetFor(id)
    },
    classifyDocumentScroll(documentScrollY: number) {
      return resolver.classify(finiteCoordinate(documentScrollY) - origin).id
    },
  })
}

/** Validates fragment semantics without changing history, focus, or scroll. */
export function getRelayFragmentAction(
  click: RelayFragmentClick,
  currentUrl: string,
  targetExists: (id: string) => boolean,
): RelayFragmentAction | null {
  if (
    click.defaultPrevented ||
    click.button !== 0 ||
    click.altKey ||
    click.ctrlKey ||
    click.metaKey ||
    click.shiftKey ||
    click.anchor.hasAttribute('download')
  ) {
    return null
  }

  const target = click.anchor.getAttribute('target')?.toLowerCase() ?? ''
  if (target && target !== '_self') return null

  const href = click.anchor.getAttribute('href')
  const action = relayAction(click.anchor.getAttribute('data-relay-action'))
  if (!href || !action) return null

  let current: URL
  let url: URL
  try {
    current = new URL(currentUrl)
    url = new URL(href, current)
  } catch {
    return null
  }
  if (
    url.origin !== current.origin ||
    url.pathname !== current.pathname ||
    url.search !== current.search ||
    !url.hash
  ) {
    return null
  }

  let targetId: string
  try {
    targetId = decodeURIComponent(url.hash.slice(1))
  } catch {
    return null
  }

  if (!relayBeatId(targetId) || !targetExists(targetId)) return null
  return { action, anchor: click.anchor, targetId, url }
}

function documentMaximumScroll(doc: Document, win: Window) {
  const height = Math.max(
    doc.documentElement.scrollHeight,
    doc.body?.scrollHeight ?? 0,
  )
  return Math.max(0, height - win.innerHeight)
}

function createGeometry(elements: RelayPlayheadElements, doc: Document, win: Window) {
  const beatElements = Array.from(
    elements.beats.querySelectorAll<HTMLElement>(BEAT_SELECTOR),
  )

  return measureRelayGeometry({
    beatElements,
    beatsTop: elements.beats.getBoundingClientRect().top,
    documentMaximumScroll: documentMaximumScroll(doc, win),
    scrollY: win.scrollY,
  })
}

function createRouteMotionRuntime(
  motion: RelayMotionFacade,
  elements: RelayPlayheadElements,
  geometry: RelayGeometry,
  win: Window,
  requestRefresh: (
    refresh: () => void,
    canRefresh: () => boolean,
  ) => void,
): RouteMotionRuntime {
  let ledger: ScrollOwnershipLedger = createScrollOwnershipLedger()
  let seekGeneration = 0
  let scrollTween: { kill(): void } | null = null
  // Require an initial quiet interval as well, covering a lazy runtime that is
  // constructed between native scroll events.
  let scrollObservedSinceRefreshCheck = true
  let destroyed = false

  const context = motion.gsap.context(() => {
    const timeline = motion.gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: elements.beats,
        start: geometry.origin,
        end: geometry.end,
        scrub: true,
      },
    })
    const signals = Array.from(
      elements.stage.querySelectorAll<SVGElement>('.relay-signal'),
    )
    const interval = geometry.end - geometry.origin

    // This duration defines the exact native-scroll/timeline mapping. Visual
    // changes are positioned inside it and controls never touch its playhead.
    timeline.to(
      elements.stage,
      { '--relay-playhead': 1, duration: Math.max(interval, 0.001) },
      0,
    )
    timeline.set(signals, { opacity: 0 }, 0)

    geometry.resolver.beats.forEach((beat, index) => {
      const signal = signals[index]
      if (!signal) return
      if (index === 0) {
        timeline.set(signal, { opacity: 1 }, 0)
        return
      }

      const previous = geometry.resolver.beats[index - 1]
      const duration = beat.seekTarget - previous.seekTarget
      if (duration <= 0) {
        timeline.set(signal, { opacity: 1, scale: 1 }, beat.seekTarget)
        return
      }
      timeline.fromTo(
        signal,
        { opacity: 0, scale: 0.65, transformOrigin: 'center' },
        {
          opacity: 1,
          scale: 1,
          duration,
        },
        previous.seekTarget,
      )
    })
  }, elements.route)

  requestRefresh(
    () => motion.ScrollTrigger.refresh(),
    () => {
      if (scrollTween !== null || ledger.phase === 'live') return false
      if (!scrollObservedSinceRefreshCheck) return true

      // Wait through one complete animation-frame interval without another
      // native scroll event so refresh never shares a frame with scrub work.
      scrollObservedSinceRefreshCheck = false
      return false
    },
  )

  function settleLiveLedger() {
    if (ledger.phase === 'live') ledger = { ...ledger, phase: 'idle' }
  }

  function stopSeek() {
    seekGeneration += 1
    const tween = scrollTween
    scrollTween = null
    tween?.kill()
    settleLiveLedger()
  }

  const observeScroll = () => {
    scrollObservedSinceRefreshCheck = true
    const observation = observeScrollPosition(ledger, win.scrollY)
    ledger = observation.ledger
    if (!observation.killSeek) return

    // The primitive latches interruption, so this path kills exactly once.
    seekGeneration += 1
    const tween = scrollTween
    scrollTween = null
    tween?.kill()
  }
  win.addEventListener('scroll', observeScroll, { passive: true })

  return Object.freeze({
    alignToBeat(id: RelayBeatId) {
      if (destroyed) return
      stopSeek()
      win.scrollTo({
        top: Math.ceil(geometry.absoluteSeekTarget(id)),
        behavior: 'auto',
      })
    },
    scrollToBeat(id: RelayBeatId) {
      if (destroyed) return
      stopSeek()
      // Native scroll positions may quantize fractional layout coordinates.
      // Ceil keeps an authored destination inside its requested beat.
      const target = Math.ceil(geometry.absoluteSeekTarget(id))
      if (Object.is(win.scrollY, target)) return

      // Claim the position at which this generation starts before GSAP can
      // deliver its first update. A trailing/coalesced scroll event from the
      // replaced seek observes this same native position and must not be
      // mistaken for a new human delta.
      ledger = recordAuthoredWrite(beginAuthoredSeek(ledger), win.scrollY)
      const generation = ++seekGeneration
      const proxy = { y: win.scrollY }
      scrollTween = motion.gsap.to(proxy, {
        y: target,
        duration: 0.55,
        ease: 'power2.out',
        onUpdate() {
          if (
            destroyed ||
            generation !== seekGeneration ||
            ledger.phase !== 'live'
          ) {
            return
          }

          ledger = recordAuthoredWrite(ledger, proxy.y)
          win.scrollTo({ top: proxy.y, behavior: 'auto' })
          // Browsers may quantize a requested CSS-pixel double. Scroll events
          // report the applied coordinate, so own that exact value as well.
          if (!Object.is(win.scrollY, proxy.y)) {
            ledger = recordAuthoredWrite(ledger, win.scrollY)
          }
        },
        onComplete() {
          if (generation !== seekGeneration) return
          settleLiveLedger()
          scrollTween = null
        },
      })
    },
    classifyDocumentScroll(scrollY: number) {
      return geometry.classifyDocumentScroll(scrollY)
    },
    isSeeking() {
      return scrollTween !== null && ledger.phase === 'live'
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      stopSeek()
      win.removeEventListener('scroll', observeScroll)
      context.revert()
    },
  })
}

export function createRelayPlayhead(
  options: RelayPlayheadOptions,
): RelayPlayhead {
  const doc = options.document ?? document
  const win = options.window ?? window
  const { elements } = options
  const media = win.matchMedia(REDUCED_MOTION_QUERY)
  const gate = createRelayRuntimeGate()
  const scrollBehavior = installDocumentScrollBehavior(doc.documentElement)
  let runtime: RouteMotionRuntime | null = null
  let pendingLoad: { canceled: boolean } | null = null
  let refreshFrame: number | null = null
  let resizeFrame: number | null = null
  let fragmentFrame: number | null = null
  let fragmentTimer: number | null = null
  let layoutWidth = win.innerWidth
  let refreshPerformed = false
  let destroyed = false
  const previousRuntimeState = elements.route.dataset.relayRuntime
  const previousBeatState = elements.route.dataset.relayBeat

  const announcer = createRelayAnnouncer({
    host: elements.liveRegion,
    schedule(task) {
      const timer = win.setTimeout(task, 0)
      return () => win.clearTimeout(timer)
    },
  })

  function cancelRefresh() {
    if (refreshFrame === null) return
    win.cancelAnimationFrame(refreshFrame)
    refreshFrame = null
  }

  function requestRefresh(
    refresh: () => void,
    canRefresh: () => boolean,
  ) {
    if (refreshPerformed || refreshFrame !== null) return

    const runWhenIdle = () => {
      refreshFrame = null
      if (destroyed || media.matches || refreshPerformed) return
      if (!canRefresh()) {
        refreshFrame = win.requestAnimationFrame(runWhenIdle)
        return
      }

      refreshPerformed = true
      refresh()
    }
    refreshFrame = win.requestAnimationFrame(runWhenIdle)
  }

  function updateStatus() {
    const id = runtime
      ? runtime.classifyDocumentScroll(win.scrollY)
      : createGeometry(elements, doc, win).classifyDocumentScroll(win.scrollY)
    if (!relayBeatId(id)) return

    elements.route.dataset.relayBeat = id
    elements.status.textContent = `Current beat: ${RELAY_BEAT_TITLES[id]}`
  }
  win.addEventListener('scroll', updateStatus, { passive: true })
  updateStatus()

  function destroyRuntime() {
    runtime?.destroy()
    runtime = null
    cancelRefresh()
    elements.route.dataset.relayRuntime = 'static'
  }

  function requestRuntime() {
    layoutWidth = win.innerWidth
    const generation = gate.issueGeneration()
    const load = { canceled: false }
    pendingLoad = load
    elements.route.dataset.relayRuntime = 'loading'

    const request = {
      generation,
      isCurrent: gate.isCurrent,
      isCanceled: () => destroyed || load.canceled || media.matches,
      createRuntime: (motion: RelayMotionFacade) =>
        createRouteMotionRuntime(
          motion,
          elements,
          createGeometry(elements, doc, win),
          win,
          requestRefresh,
        ),
    }
    const pending = options.importMotion
      ? loadRelayRuntime({ ...request, importMotion: options.importMotion })
      : loadRelayRuntime(request)

    void pending
      .then((result) => {
        if (pendingLoad === load) pendingLoad = null
        if (result.status !== 'created') return
        runtime = result.runtime
        elements.route.dataset.relayRuntime = 'ready'
        updateStatus()
        if (win.location.hash) handleFragmentHistory()
      })
      .catch(() => {
        if (
          destroyed ||
          load.canceled ||
          !gate.isCurrent(generation)
        ) {
          return
        }
        if (pendingLoad === load) pendingLoad = null
        elements.route.dataset.relayRuntime = 'static'
      })
  }

  function applyMotionPreference() {
    pendingLoad && (pendingLoad.canceled = true)
    pendingLoad = null
    gate.issueGeneration()
    destroyRuntime()
    if (!destroyed && !media.matches) requestRuntime()
  }

  function alignCurrentFragment() {
    let id: string
    try {
      id = decodeURIComponent(win.location.hash.slice(1))
    } catch {
      return
    }
    if (!relayBeatId(id) || doc.getElementById(id) === null) return
    if (runtime) {
      runtime.alignToBeat(id)
      return
    }
    const scrollTarget = Math.ceil(
      createGeometry(elements, doc, win).absoluteSeekTarget(id),
    )
    win.scrollTo({ top: scrollTarget, behavior: 'auto' })
  }

  const handleFragmentHistory = () => {
    if (fragmentFrame !== null) win.cancelAnimationFrame(fragmentFrame)
    fragmentFrame = win.requestAnimationFrame(() => {
      fragmentFrame = win.requestAnimationFrame(() => {
        fragmentFrame = null
        if (!destroyed) alignCurrentFragment()
      })
    })
  }

  const handleResize = () => {
    if (destroyed || media.matches) return
    if (win.innerWidth === layoutWidth) return
    if (resizeFrame !== null) win.cancelAnimationFrame(resizeFrame)
    const rebuildWhenIdle = () => {
      if (destroyed || media.matches || win.innerWidth === layoutWidth) {
        resizeFrame = null
        return
      }
      if (runtime?.isSeeking()) {
        resizeFrame = win.requestAnimationFrame(rebuildWhenIdle)
        return
      }
      resizeFrame = null
      layoutWidth = win.innerWidth
      pendingLoad && (pendingLoad.canceled = true)
      pendingLoad = null
      gate.issueGeneration()
      destroyRuntime()
      requestRuntime()
    }
    resizeFrame = win.requestAnimationFrame(rebuildWhenIdle)
  }

  const handleClick = (event: MouseEvent) => {
    const target = event.target as Element | null
    const anchor = target?.closest?.(CONTROL_SELECTOR) as
      | HTMLAnchorElement
      | null
    if (!anchor || !elements.route.contains(anchor)) return

    const fragment = getRelayFragmentAction(
      {
        altKey: event.altKey,
        anchor,
        button: event.button,
        ctrlKey: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      },
      win.location.href,
      (id) => doc.getElementById(id) !== null,
    )
    if (!fragment) return

    // Every valid discrete activation is announced, including identical and
    // static-fallback actions. Scrub/status updates never enter this queue.
    announcer.announceAction(fragment.action, fragment.targetId)
    event.preventDefault()
    win.history.pushState(
      null,
      '',
      `${fragment.url.pathname}${fragment.url.search}${fragment.url.hash}`,
    )
    if (runtime) {
      runtime.scrollToBeat(fragment.targetId)
      return
    }

    // Reduced motion keeps the same native-scroll authority without loading
    // GSAP, while landing fractional beat boundaries pixel-safely.
    const scrollTarget = Math.ceil(
      createGeometry(elements, doc, win).absoluteSeekTarget(fragment.targetId),
    )
    win.scrollTo({ top: scrollTarget, behavior: 'auto' })
  }
  elements.route.addEventListener('click', handleClick)
  media.addEventListener('change', applyMotionPreference)
  win.addEventListener('resize', handleResize)
  win.addEventListener('popstate', handleFragmentHistory)
  win.addEventListener('hashchange', handleFragmentHistory)
  if (media.matches) destroyRuntime()
  else requestRuntime()
  if (win.location.hash) {
    fragmentTimer = win.setTimeout(() => {
      fragmentTimer = null
      if (!destroyed) alignCurrentFragment()
    }, 0)
  }

  return Object.freeze({
    destroy() {
      if (destroyed) return
      destroyed = true
      pendingLoad && (pendingLoad.canceled = true)
      pendingLoad = null
      gate.issueGeneration()
      media.removeEventListener('change', applyMotionPreference)
      win.removeEventListener('resize', handleResize)
      win.removeEventListener('popstate', handleFragmentHistory)
      win.removeEventListener('hashchange', handleFragmentHistory)
      elements.route.removeEventListener('click', handleClick)
      win.removeEventListener('scroll', updateStatus)
      if (resizeFrame !== null) win.cancelAnimationFrame(resizeFrame)
      resizeFrame = null
      if (fragmentFrame !== null) win.cancelAnimationFrame(fragmentFrame)
      fragmentFrame = null
      if (fragmentTimer !== null) win.clearTimeout(fragmentTimer)
      fragmentTimer = null
      destroyRuntime()
      announcer.destroy()
      elements.liveRegion.textContent = ''
      scrollBehavior.destroy()
      if (previousRuntimeState === undefined) {
        delete elements.route.dataset.relayRuntime
      } else {
        elements.route.dataset.relayRuntime = previousRuntimeState
      }
      if (previousBeatState === undefined) {
        delete elements.route.dataset.relayBeat
      } else {
        elements.route.dataset.relayBeat = previousBeatState
      }
    },
  })
}
