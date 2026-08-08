export const MIN_ADAPTIVE_DPR = 1
export const MAX_ADAPTIVE_DPR = 1.5

const DEFAULT_FRAME_BUDGET_MS = 1000 / 45
const DEFAULT_ACTIVITY_WINDOW_MS = 250
const DEFAULT_SUSTAINED_FRAME_COUNT = 3

export interface AdaptivePerformanceSample {
  readonly current: number
  readonly min: number
  readonly max: number
  readonly debounce: number
}

export interface AdaptiveDprTimer {
  readonly set: (callback: () => void, delayMs: number) => unknown
  readonly clear: (handle: unknown) => void
}

export interface ResumeFrameScheduler {
  readonly request: (callback: () => void) => unknown
  readonly cancel: (handle: unknown) => void
}

export interface ResumeActivityGate {
  arm(): void
  beginSettlement(): void
  clearForUserActivity(): void
  isBlocked(): boolean
  subscribe(listener: () => void): () => void
  destroy(): void
}

function browserFrameScheduler(): ResumeFrameScheduler {
  return {
    request(callback) {
      if (typeof window === 'undefined') return setTimeout(callback, 0)
      return window.requestAnimationFrame(() => callback())
    },
    cancel(handle) {
      if (typeof window === 'undefined') {
        clearTimeout(handle as ReturnType<typeof setTimeout>)
        return
      }
      window.cancelAnimationFrame(handle as number)
    },
  }
}

export function createResumeActivityGate(
  scheduler: ResumeFrameScheduler = browserFrameScheduler(),
): ResumeActivityGate {
  const listeners = new Set<() => void>()
  let blocked = false
  let firstFrame: unknown = null
  let secondFrame: unknown = null

  const cancelSettlement = () => {
    if (firstFrame !== null) scheduler.cancel(firstFrame)
    if (secondFrame !== null) scheduler.cancel(secondFrame)
    firstFrame = null
    secondFrame = null
  }

  const release = () => {
    if (!blocked) return
    cancelSettlement()
    blocked = false
    listeners.forEach((listener) => listener())
  }

  return {
    arm() {
      if (blocked) {
        cancelSettlement()
        return
      }
      blocked = true
    },
    beginSettlement() {
      if (!blocked || firstFrame !== null || secondFrame !== null) return
      firstFrame = scheduler.request(() => {
        firstFrame = null
        secondFrame = scheduler.request(() => {
          secondFrame = null
          release()
        })
      })
    },
    clearForUserActivity: release,
    isBlocked() {
      return blocked
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy() {
      cancelSettlement()
      blocked = false
      listeners.clear()
    },
  }
}

export interface AdaptiveActivityTarget {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
}

const DIRECT_ACTIVITY_EVENTS = [
  'wheel',
  'touchstart',
  'touchmove',
  'pointerdown',
  'pointermove',
  'keydown',
] as const

export function bindAdaptiveDprActivity(
  target: AdaptiveActivityTarget,
  gate: ResumeActivityGate,
  onActivity: () => void,
): () => void {
  const handleDirectActivity: EventListener = (event) => {
    if (event.type === 'pointermove') {
      const pointer = event as Event & {
        readonly buttons?: number
        readonly pointerType?: string
      }
      if (pointer.pointerType === 'mouse' && pointer.buttons === 0) return
    }
    gate.clearForUserActivity()
    onActivity()
  }
  const handleScroll: EventListener = () => {
    if (!gate.isBlocked()) onActivity()
  }

  DIRECT_ACTIVITY_EVENTS.forEach((type) =>
    target.addEventListener(type, handleDirectActivity, { passive: true }),
  )
  target.addEventListener('scroll', handleScroll, { passive: true })

  return () => {
    DIRECT_ACTIVITY_EVENTS.forEach((type) =>
      target.removeEventListener(type, handleDirectActivity),
    )
    target.removeEventListener('scroll', handleScroll)
  }
}

export function mapPerformanceToDpr(
  current: number,
  minimumPerformance: number,
  maximumPerformance: number,
): number {
  const span = maximumPerformance - minimumPerformance
  const normalized =
    span <= 0
      ? current >= maximumPerformance
        ? 1
        : 0
      : (current - minimumPerformance) / span
  const bounded = Math.min(1, Math.max(0, normalized))
  return Math.round(
    (MIN_ADAPTIVE_DPR +
      bounded * (MAX_ADAPTIVE_DPR - MIN_ADAPTIVE_DPR)) *
      1000,
  ) / 1000
}

export interface AdaptiveDprController {
  recordActivity(): void
  sample(deltaSeconds: number, performance: AdaptivePerformanceSample): void
  acknowledgeDpr(dpr: number): void
  setPaused(paused: boolean): void
  setReducedMotion(
    reducedMotion: boolean,
    performance: AdaptivePerformanceSample,
  ): void
  destroy(): void
}

export interface AdaptiveDprControllerOptions {
  readonly initialDpr: number
  readonly initiallyPaused: boolean
  readonly initiallyReducedMotion?: boolean
  readonly gate: ResumeActivityGate
  readonly now: () => number
  readonly timer: AdaptiveDprTimer
  readonly regress: () => void
  readonly invalidate: () => void
  readonly reportDpr: (dpr: number) => void
  readonly frameBudgetMs?: number
  readonly activityWindowMs?: number
  readonly sustainedFrameCount?: number
}

export function createAdaptiveDprController({
  initialDpr,
  initiallyPaused,
  initiallyReducedMotion = false,
  gate,
  now,
  timer,
  regress,
  invalidate,
  reportDpr,
  frameBudgetMs = DEFAULT_FRAME_BUDGET_MS,
  activityWindowMs = DEFAULT_ACTIVITY_WINDOW_MS,
  sustainedFrameCount = DEFAULT_SUSTAINED_FRAME_COUNT,
}: AdaptiveDprControllerOptions): AdaptiveDprController {
  let committedDpr = initialDpr
  let pendingDpr: number | null = null
  let paused = initiallyPaused
  let reducedMotion = initiallyReducedMotion
  let lastActivityAt = Number.NEGATIVE_INFINITY
  let ignoreNextActiveSample = true
  let overBudgetFrames = 0
  let pressureBurstActive = false
  let recoveryDueAt: number | null = null
  let recoveryTimer: unknown = null
  let recoveryInvalidationIssued = false
  let resumeAwaitingSettlement = false
  let destroyed = false

  const clearRecoveryTimer = () => {
    if (recoveryTimer === null) return
    timer.clear(recoveryTimer)
    recoveryTimer = null
  }

  const publishDpr = (nextDpr: number) => {
    if (
      pendingDpr === nextDpr ||
      (pendingDpr === null && committedDpr === nextDpr)
    ) {
      return
    }
    pendingDpr = nextDpr
    reportDpr(nextDpr)
  }

  const finishRecovery = () => {
    clearRecoveryTimer()
    recoveryDueAt = null
    recoveryInvalidationIssued = false
  }

  const requestRecoveryFrame = () => {
    if (
      destroyed ||
      paused ||
      gate.isBlocked() ||
      recoveryDueAt === null ||
      recoveryInvalidationIssued
    ) {
      return
    }
    recoveryInvalidationIssued = true
    invalidate()
  }

  const scheduleRecovery = () => {
    clearRecoveryTimer()
    if (destroyed || paused || gate.isBlocked() || recoveryDueAt === null) {
      return
    }
    const remaining = recoveryDueAt - now()
    if (remaining <= 0) {
      requestRecoveryFrame()
      return
    }
    recoveryTimer = timer.set(() => {
      recoveryTimer = null
      requestRecoveryFrame()
    }, remaining)
  }

  const unsubscribeGate = gate.subscribe(() => {
    if (destroyed || paused || !resumeAwaitingSettlement) return
    resumeAwaitingSettlement = false
    if (recoveryDueAt !== null && recoveryDueAt <= now()) {
      requestRecoveryFrame()
      return
    }
    invalidate()
    scheduleRecovery()
  })

  return {
    recordActivity() {
      if (destroyed || paused) return
      const activityAt = now()
      if (activityAt - lastActivityAt > activityWindowMs) {
        ignoreNextActiveSample = true
        overBudgetFrames = 0
        pressureBurstActive = false
      }
      lastActivityAt = activityAt
    },
    sample(deltaSeconds, performance) {
      if (destroyed || paused || gate.isBlocked()) return

      const mappedDpr = reducedMotion
        ? MIN_ADAPTIVE_DPR
        : mapPerformanceToDpr(
            performance.current,
            performance.min,
            performance.max,
          )
      publishDpr(mappedDpr)
      if (!reducedMotion && mappedDpr === MAX_ADAPTIVE_DPR) finishRecovery()
      if (reducedMotion) return

      if (now() - lastActivityAt > activityWindowMs) {
        ignoreNextActiveSample = true
        overBudgetFrames = 0
        pressureBurstActive = false
        return
      }
      if (ignoreNextActiveSample) {
        ignoreNextActiveSample = false
        return
      }

      if (deltaSeconds * 1000 <= frameBudgetMs) {
        overBudgetFrames = 0
        pressureBurstActive = false
        return
      }
      overBudgetFrames += 1
      if (
        overBudgetFrames < sustainedFrameCount ||
        pressureBurstActive
      ) {
        return
      }

      pressureBurstActive = true
      regress()
      publishDpr(
        mapPerformanceToDpr(
          performance.min,
          performance.min,
          performance.max,
        ),
      )
      invalidate()
      recoveryDueAt = now() + Math.max(0, performance.debounce)
      recoveryInvalidationIssued = false
      scheduleRecovery()
    },
    acknowledgeDpr(dpr) {
      if (destroyed) return
      if (pendingDpr !== null) {
        if (dpr !== pendingDpr) return
        committedDpr = dpr
        pendingDpr = null
        return
      }
      committedDpr = dpr
    },
    setPaused(nextPaused) {
      if (destroyed || paused === nextPaused) return
      paused = nextPaused
      overBudgetFrames = 0
      ignoreNextActiveSample = true
      pressureBurstActive = false
      if (paused) {
        clearRecoveryTimer()
        recoveryInvalidationIssued = false
        resumeAwaitingSettlement = false
        return
      }
      if (gate.isBlocked()) {
        resumeAwaitingSettlement = true
        return
      }
      scheduleRecovery()
    },
    setReducedMotion(nextReducedMotion, performance) {
      if (destroyed || reducedMotion === nextReducedMotion) return
      reducedMotion = nextReducedMotion
      overBudgetFrames = 0
      pressureBurstActive = false
      if (reducedMotion) {
        finishRecovery()
        publishDpr(MIN_ADAPTIVE_DPR)
        return
      }
      publishDpr(
        mapPerformanceToDpr(
          performance.current,
          performance.min,
          performance.max,
        ),
      )
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      clearRecoveryTimer()
      unsubscribeGate()
    },
  }
}

export function controlledDprAfterManagerReport(
  _currentDpr: number,
  reportedDpr: number,
): number {
  return Math.min(
    MAX_ADAPTIVE_DPR,
    Math.max(MIN_ADAPTIVE_DPR, reportedDpr),
  )
}
