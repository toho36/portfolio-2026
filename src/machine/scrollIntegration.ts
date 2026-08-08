import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { CartridgeIndex } from '../content/cartridges'
import { conveyorIndex, conveyorStop } from '../loops/conveyor/model'
import { timelineIndex } from '../loops/timeline/model'
import { gsap } from '../motion/gsap'
import {
  presentMachineProgress,
  type StageIndex,
} from './runtime'

export interface PresentationValues {
  readonly conveyorProgress: number
  readonly timelineProgress: number
}

export interface PresentationTarget {
  apply(values: PresentationValues): void
}

export interface PresentationBridge {
  publish(values: PresentationValues): void
  attach(target: PresentationTarget): () => void
  setPaused(paused: boolean): void
  replay(): void
}

export function createPresentationBridge(
  initial: PresentationValues = {
    conveyorProgress: 0,
    timelineProgress: 0,
  },
  initiallyPaused = false,
): PresentationBridge {
  let latest = initial
  let target: PresentationTarget | null = null
  let paused = initiallyPaused

  return {
    publish(values) {
      latest = values
      if (paused) return
      target?.apply(latest)
    },
    attach(nextTarget) {
      target = nextTarget
      if (!paused) target.apply(latest)
      return () => {
        if (target === nextTarget) target = null
      }
    },
    setPaused(nextPaused) {
      paused = nextPaused
    },
    replay() {
      if (!paused) target?.apply(latest)
    },
  }
}

interface ProxyTimeline {
  setProgress(progress: number): void
  kill(): void
}

interface NativeScrollTrigger {
  readonly start: number
  readonly end: number
  readonly progress: number
  refresh(): void
  kill(): void
}

export interface ScrollCoordinatorDependencies {
  createTimeline(
    proxy: PresentationValues,
    onUpdate: () => void,
  ): ProxyTimeline
  createTrigger(
    runway: HTMLElement,
    onProgress: (progress: number) => void,
  ): NativeScrollTrigger
  scrollTo(top: number): void
}

const browserDependencies: ScrollCoordinatorDependencies = {
  createTimeline(proxy, onUpdate) {
    let updates = 0
    const timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        updates += 1
        onUpdate()
      },
    })
    timeline.to(proxy, {
      conveyorProgress: 1,
      timelineProgress: 1,
      duration: 1,
      ease: 'none',
    })
    return {
      setProgress(progress) {
        const previousUpdates = updates
        timeline.progress(progress)
        // GSAP does not call onUpdate when seeking to its current value. The
        // same-value path still has to acknowledge a freshly armed guard.
        if (updates === previousUpdates) onUpdate()
      },
      kill() {
        timeline.kill()
      },
    }
  },
  createTrigger(runway, onProgress) {
    const trigger = ScrollTrigger.create({
      trigger: runway,
      start: 'top top',
      end: 'bottom bottom',
      pin: false,
      onUpdate: (self) => onProgress(self.progress),
    })
    return {
      get start() {
        return trigger.start
      },
      get end() {
        return trigger.end
      },
      get progress() {
        return trigger.progress
      },
      refresh() {
        trigger.refresh()
      },
      kill() {
        trigger.kill()
      },
    }
  },
  scrollTo(top) {
    window.scrollTo({ top, behavior: 'auto' })
  },
}

export interface MachineScrollCoordinatorOptions {
  readonly runway: HTMLElement
  readonly bridge: PresentationBridge
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly onConveyorStop: (index: CartridgeIndex) => void
  readonly onTimelineStop: (index: StageIndex) => void
}

export interface MachineScrollCoordinator {
  refresh(): void
  requestTarget(index: StageIndex): void
  setPaused(paused: boolean): void
  setReducedMotion(reduced: boolean): void
  destroy(): void
}

export function createMachineScrollCoordinator(
  options: MachineScrollCoordinatorOptions,
  dependencies: ScrollCoordinatorDependencies = browserDependencies,
): MachineScrollCoordinator {
  const proxy = {
    conveyorProgress: 0,
    timelineProgress: 0,
  }
  let paused = options.paused
  let reducedMotion = options.reducedMotion
  let guardTarget: StageIndex | null = null
  let lastConveyorStop: CartridgeIndex | null = null
  let lastTimelineStop: StageIndex | null = null
  let destroyed = false

  const publishProxy = () => {
    if (paused || destroyed) return

    const presentation = presentMachineProgress(proxy, reducedMotion)
    options.bridge.publish({
      conveyorProgress: presentation.conveyor.progress,
      timelineProgress: presentation.timeline.progress,
    })

    const nextConveyor = conveyorIndex(proxy.conveyorProgress) as CartridgeIndex
    if (nextConveyor !== lastConveyorStop) {
      lastConveyorStop = nextConveyor
      options.onConveyorStop(nextConveyor)
    }

    const nextTimeline = timelineIndex(proxy.timelineProgress) as StageIndex
    if (nextTimeline !== lastTimelineStop) {
      lastTimelineStop = nextTimeline
      options.onTimelineStop(nextTimeline)
    }
    if (nextTimeline === guardTarget) guardTarget = null
  }

  // The proxy tween is deliberately non-empty and paused. ScrollTrigger only
  // supplies native progress; it never pins or owns the timeline.
  const timeline = dependencies.createTimeline(proxy, publishProxy)
  const trigger = dependencies.createTrigger(options.runway, (progress) => {
    if (paused || destroyed) return
    timeline.setProgress(progress)
  })

  const performSeek = (index: StageIndex) => {
    if (paused || destroyed) return
    const progress = conveyorStop(index)
    const distance = Math.max(0, trigger.end - trigger.start)
    const top = trigger.start + distance * progress

    // Reset the independent observations so an exact same-stop seek can settle
    // a newly installed guard without sharing channel state.
    lastConveyorStop = null
    lastTimelineStop = null
    dependencies.scrollTo(top)
    timeline.setProgress(progress)
  }

  options.bridge.setPaused(paused)

  return {
    refresh() {
      if (!destroyed) trigger.refresh()
    },
    requestTarget(index) {
      if (destroyed) return
      guardTarget = index
      if (!paused) performSeek(index)
    },
    setPaused(nextPaused) {
      if (destroyed || paused === nextPaused) return
      if (nextPaused) {
        paused = true
        options.bridge.setPaused(true)
        return
      }

      // Refresh while callbacks are gated so resuming a retained intent cannot
      // publish an intermediate native-scroll position before its one seek.
      if (guardTarget !== null) trigger.refresh()
      paused = false
      options.bridge.setPaused(false)
      if (guardTarget !== null) {
        performSeek(guardTarget)
      } else {
        trigger.refresh()
        timeline.setProgress(trigger.progress)
      }
    },
    setReducedMotion(reduced) {
      if (destroyed || reducedMotion === reduced) return
      reducedMotion = reduced
      if (!paused) publishProxy()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      trigger.kill()
      timeline.kill()
    },
  }
}

export interface PostHashReconcilerOptions {
  readonly getHash: () => string
  readonly indexForHash: (hash: string) => StageIndex | null
  readonly requestFrame: (callback: FrameRequestCallback) => number
  readonly cancelFrame: (handle: number) => void
  readonly refresh: () => void
  readonly armGuard: (index: StageIndex) => void
  readonly seek: (index: StageIndex) => void
  readonly focus: (index: StageIndex, options: FocusOptions) => void
  readonly onReconciled?: () => void
}

export interface PostHashReconciler {
  schedule(): void
  hasPending(): boolean
  destroy(): void
}

export function createPostHashReconciler(
  options: PostHashReconcilerOptions,
): PostHashReconciler {
  let frame: number | null = null
  let pendingIndex: StageIndex | null = null

  return {
    schedule() {
      if (frame !== null) options.cancelFrame(frame)
      pendingIndex = options.indexForHash(options.getHash())
      if (pendingIndex === null) {
        frame = null
        return
      }
      frame = options.requestFrame(() => {
        const index = pendingIndex
        frame = null
        pendingIndex = null
        if (index === null) return
        options.refresh()
        options.armGuard(index)
        options.seek(index)
        options.focus(index, { preventScroll: true })
        options.onReconciled?.()
      })
    },
    hasPending() {
      return pendingIndex !== null
    },
    destroy() {
      if (frame !== null) options.cancelFrame(frame)
      frame = null
      pendingIndex = null
    },
  }
}

export interface NativeAnchorClick {
  readonly altKey: boolean
  readonly button: number
  readonly ctrlKey: boolean
  readonly defaultPrevented: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

export function shouldReconcileSameHashClick(
  event: NativeAnchorClick,
  currentHash: string,
  targetHash: string,
): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    currentHash === targetHash
  )
}

export function focusMachineTarget(
  target: HTMLElement,
  reconcileScroll: boolean,
): void {
  if (reconcileScroll) {
    target.focus({ preventScroll: true })
  } else {
    target.focus()
  }
}
