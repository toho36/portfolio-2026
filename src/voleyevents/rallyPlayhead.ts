import { measureRallyStaircase, type RallyStaircase } from './rallyProgress'
import type { RallyStaircaseRuntime } from './rallyRuntime'

interface RallyMotionContext {
  revert(): void
}

interface RallyMotionTrigger {
  kill(): void
}

export interface RallyPlayheadMotion {
  readonly gsap: {
    context(
      callback: (context?: RallyMotionContext) => void,
      scope: Element,
    ): RallyMotionContext
  }
  readonly ScrollTrigger: {
    create(options: object): RallyMotionTrigger
    refresh(): void
  }
}

export interface RallyPlayheadDocument {
  readonly visibilityState: DocumentVisibilityState
  readonly documentElement: { readonly scrollHeight: number }
  readonly body: { readonly scrollHeight: number } | null
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

export interface RallyPlayheadWindow {
  readonly scrollY: number
  readonly innerWidth: number
  readonly innerHeight: number
  readonly devicePixelRatio: number
  readonly document: RallyPlayheadDocument
  readonly performance: { now(): number }
  readonly IntersectionObserver?: new (
    callback: IntersectionObserverCallback,
  ) => IntersectionObserver
  requestAnimationFrame(callback: FrameRequestCallback): number
  cancelAnimationFrame(handle: number): void
  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions | boolean): void
  removeEventListener(type: string, listener: EventListener): void
}

export interface RallyFrameScheduler {
  request(callback: FrameRequestCallback): number
  cancel(handle: number): void
  now(): number
}

export interface RallyVisibilityObserver {
  observe(target: Element): void
  disconnect(): void
}

export interface RallyPlayheadOptions {
  readonly elements: {
    readonly root: HTMLElement
    readonly stage: HTMLElement
  }
  readonly motion: RallyPlayheadMotion
  readonly runtime: RallyStaircaseRuntime
  readonly window: RallyPlayheadWindow
  readonly scheduler?: RallyFrameScheduler
  readonly createObserver?: (
    callback: (entries: readonly { readonly isIntersecting: boolean }[]) => void,
  ) => RallyVisibilityObserver
}

export interface RallyPlayhead {
  destroy(): void
}

function documentMaximumScroll(doc: RallyPlayheadDocument, viewportHeight: number) {
  return Math.max(
    0,
    Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0) - viewportHeight,
  )
}

const RALLY_STOP_IDS = [
  'event-opens',
  'player-registers',
  'payment-matches',
  'attendance-resolves',
] as const

function finiteCoordinate(value: number) {
  return Number.isFinite(value) ? value : 0
}

function elementRect(element: HTMLElement) {
  const getRect = element.getBoundingClientRect
  if (typeof getRect !== 'function') return { top: null, height: null }
  const rect = getRect.call(element)
  return {
    top: Number.isFinite(rect.top) ? rect.top : null,
    height: Number.isFinite(rect.height) ? rect.height : null,
  }
}

function measure(
  root: HTMLElement,
  stage: HTMLElement,
  win: RallyPlayheadWindow,
): RallyStaircase {
  const band = typeof root.querySelector === 'function'
    ? root.querySelector<HTMLElement>('.rally-band') ?? root
    : root
  const bandRect = elementRect(band)
  const rootRect = band === root ? bandRect : elementRect(root)
  const stageRect = elementRect(stage)
  const bandTop = bandRect.top
  const bandHeight = bandRect.height
  const stageHeight = stageRect.height
  const scrollY = finiteCoordinate(win.scrollY)
  const viewportHeight = Math.max(0, finiteCoordinate(win.innerHeight))
  const rootTop = bandTop ?? rootRect.top ?? 0
  const origin = rootTop + scrollY
  let measuredEnd = documentMaximumScroll(win.document, viewportHeight)
  if (bandTop !== null && bandHeight !== null && stageHeight !== null) {
    measuredEnd = origin + Math.max(0, bandHeight - stageHeight)
  }
  const end = Math.max(origin, finiteCoordinate(measuredEnd))
  const runway = end - origin

  return measureRallyStaircase({
    rootTop,
    viewportHeight,
    // The band owns the maximum scroll consumed by the staircase. Synthetic
    // viewport-midpoint crossings preserve the existing history-free model.
    documentMaximumScroll: end,
    scrollY,
    landings: RALLY_STOP_IDS.map((id, index) => ({
      id,
      top: origin
        + (runway * (index + 1)) / RALLY_STOP_IDS.length
        - scrollY
        + viewportHeight / 2,
    })),
  })
}

function defaultObserver(
  win: RallyPlayheadWindow,
  callback: (entries: readonly { readonly isIntersecting: boolean }[]) => void,
): RallyVisibilityObserver | null {
  if (!win.IntersectionObserver) return null
  return new win.IntersectionObserver((entries) => callback(entries))
}

export function createRallyPlayhead(options: RallyPlayheadOptions): RallyPlayhead {
  const { elements, motion, runtime, window: win } = options
  const doc = win.document
  const scheduler = options.scheduler ?? {
    request: (callback: FrameRequestCallback) => win.requestAnimationFrame(callback),
    cancel: (handle: number) => win.cancelAnimationFrame(handle),
    now: () => win.performance.now(),
  }
  const previousActive = elements.root.dataset.rallyActive
  let geometry: RallyStaircase
  let context: RallyMotionContext | null = null
  let trigger: RallyMotionTrigger | null = null
  let observer: RallyVisibilityObserver | null = null
  let settleFrame: number | null = null
  let resizeFrame: number | null = null
  let resizePending = false
  let suppressImpacts = false
  let intersecting = true
  let previousIndex = 0
  let lastAppliedScroll: number | null = null
  let destroyed = false

  const active = () =>
    !destroyed && intersecting && doc.visibilityState !== 'hidden'

  function cancelSettle() {
    if (settleFrame === null) return
    scheduler.cancel(settleFrame)
    settleFrame = null
  }

  function cancelResize() {
    if (resizeFrame === null) return
    scheduler.cancel(resizeFrame)
    resizeFrame = null
  }

  function requestSettle() {
    if (!active() || settleFrame !== null) return
    settleFrame = scheduler.request((time) => {
      settleFrame = null
      if (!active()) return
      if (runtime.render(time)) requestSettle()
    })
  }

  function emitCrossedImpacts(nextIndex: number) {
    const now = scheduler.now()
    if (nextIndex > previousIndex) {
      for (let index = previousIndex + 1; index <= nextIndex; index += 1) {
        runtime.impact(index, now)
      }
    } else if (nextIndex < previousIndex) {
      for (let index = previousIndex; index > nextIndex; index -= 1) {
        runtime.impact(index, now)
      }
    }
    if (nextIndex !== previousIndex) requestSettle()
  }

  function applyNativeProgress(impacts: boolean, force = false) {
    if (!active()) return
    const nativePosition = win.scrollY
    if (!force && Object.is(nativePosition, lastAppliedScroll)) return
    const state = geometry.stateFor(nativePosition)
    elements.root.dataset.rallyActive = state.id
    runtime.setProgress(state.progress)
    if (impacts) emitCrossedImpacts(state.index)
    previousIndex = state.index
    lastAppliedScroll = nativePosition
  }

  function performResize() {
    resizePending = false
    suppressImpacts = true
    try {
      geometry = measure(elements.root, elements.stage, win)
      runtime.resize()
      motion.ScrollTrigger.refresh()
      lastAppliedScroll = null
      applyNativeProgress(false, true)
    } finally {
      suppressImpacts = false
    }
  }

  function requestResize() {
    resizePending = true
    if (!active()) return
    cancelResize()
    resizeFrame = scheduler.request(() => {
      resizeFrame = null
      if (!active() || !resizePending) return
      performResize()
    })
  }

  const handleScroll: EventListener = () => applyNativeProgress(true)
  const handleResize: EventListener = () => requestResize()
  const handleVisibility: EventListener = () => {
    if (!active()) {
      cancelSettle()
      cancelResize()
      return
    }
    if (resizePending) performResize()
    else {
      lastAppliedScroll = null
      applyNativeProgress(false, true)
      if (runtime.render(scheduler.now())) requestSettle()
    }
  }
  const handleIntersection = (
    entries: readonly { readonly isIntersecting: boolean }[],
  ) => {
    const next = entries.at(-1)?.isIntersecting ?? intersecting
    if (next === intersecting || destroyed) return
    intersecting = next
    if (!active()) {
      cancelSettle()
      cancelResize()
      return
    }
    if (resizePending) performResize()
    else {
      lastAppliedScroll = null
      applyNativeProgress(false, true)
      if (runtime.render(scheduler.now())) requestSettle()
    }
  }

  function teardown() {
    if (destroyed) return
    destroyed = true
    cancelSettle()
    cancelResize()
    // GSAP normally owns the trigger through its context. Keep the trigger as
    // a construction fallback in case context() throws before returning.
    if (context) context.revert()
    else trigger?.kill()
    context = null
    trigger = null
    win.removeEventListener('scroll', handleScroll)
    win.removeEventListener('resize', handleResize)
    win.removeEventListener('orientationchange', handleResize)
    doc.removeEventListener('visibilitychange', handleVisibility)
    observer?.disconnect()
    observer = null
    runtime.destroy()
    if (previousActive === undefined) {
      delete elements.root.dataset.rallyActive
    } else {
      elements.root.dataset.rallyActive = previousActive
    }
  }

  try {
    geometry = measure(elements.root, elements.stage, win)
    const initialState = geometry.stateFor(win.scrollY)
    previousIndex = initialState.index
    elements.root.dataset.rallyActive = initialState.id

    context = motion.gsap.context((creatingContext) => {
      // GSAP supplies the context before context() returns. Capturing it here
      // makes setup transactional even if the outer call subsequently throws.
      if (creatingContext) context = creatingContext
      trigger = motion.ScrollTrigger.create({
        trigger: elements.root,
        start: () => geometry.origin,
        end: () => geometry.end,
        invalidateOnRefresh: true,
        onUpdate: () => applyNativeProgress(!suppressImpacts),
      })
    }, elements.root)

    win.addEventListener('scroll', handleScroll, { passive: true })
    win.addEventListener('resize', handleResize, { passive: true })
    win.addEventListener('orientationchange', handleResize, { passive: true })
    doc.addEventListener('visibilitychange', handleVisibility)
    observer = options.createObserver
      ? options.createObserver(handleIntersection)
      : defaultObserver(win, handleIntersection)
    observer?.observe(elements.stage)
    applyNativeProgress(false, true)
  } catch (error) {
    teardown()
    throw error
  }

  return Object.freeze({ destroy: teardown })
}
