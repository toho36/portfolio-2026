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

function measure(
  root: HTMLElement,
  win: RallyPlayheadWindow,
): RallyStaircase {
  const landings = Array.from(
    root.querySelectorAll<HTMLElement>('.lifecycle-stage[id]'),
  )
  return measureRallyStaircase({
    rootTop: root.getBoundingClientRect().top,
    viewportHeight: win.innerHeight,
    documentMaximumScroll: documentMaximumScroll(win.document, win.innerHeight),
    scrollY: win.scrollY,
    landings: landings.map((landing) => ({
      id: landing.id,
      top: landing.getBoundingClientRect().top,
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
      geometry = measure(elements.root, win)
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
    geometry = measure(elements.root, win)
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
