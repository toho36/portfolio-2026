import { importRelayMotion } from '../../../playground/loadRelayRuntime'

/** Milliseconds; divide by 1000 when passing to GSAP. */
export const MOTION_MS = {
  P1_STEP: 240,
  INDEX_SWAP: 220,
  DETAIL: 260,
  SWITCH_SWAP: 280,
  CONTROL_FEEDBACK: 140,
} as const
export const { P1_STEP, INDEX_SWAP, DETAIL, SWITCH_SWAP, CONTROL_FEEDBACK } = MOTION_MS
export const DETAIL_ZOOM = DETAIL
export const EASING = 'cubic-bezier(.16,1,.3,1)'
export type Dispose = () => void

export function prefersReducedMotion(): boolean
export function prefersReducedMotion(onChange: (reduced: boolean) => void): Dispose
export function prefersReducedMotion(onChange?: (reduced: boolean) => void): boolean | Dispose {
  const media = typeof window === 'undefined' ? undefined : window.matchMedia('(prefers-reduced-motion: reduce)')
  if (!onChange) return media?.matches ?? false
  const changed = () => onChange(media?.matches ?? false)
  media?.addEventListener('change', changed)
  return () => media?.removeEventListener('change', changed)
}

export function duration(event: keyof typeof MOTION_MS): number {
  return prefersReducedMotion() ? 0 : MOTION_MS[event]
}

/** Pass pause for timelines. Cancel-only owners settle when the document hides.
 * Visibility never resumes playback automatically; the next user action does.
 */
export function createDominantMotion() {
  const doc = typeof document === 'undefined' ? undefined : document
  let active: { id: string; cancel: Dispose; pause?: Dispose } | undefined
  const clear = () => {
    const previous = active
    active = undefined
    previous?.cancel()
  }
  const visibility = () => {
    if (!doc?.hidden || !active) return
    if (active.pause) active.pause()
    else clear()
  }
  let listening = false
  return {
    start(id: string, cancel: Dispose, pause?: Dispose): boolean {
      if (doc?.hidden) return false
      // Lazy registration survives React StrictMode cleanup/re-setup without render-time listeners.
      if (!listening) { doc?.addEventListener('visibilitychange', visibility); listening = true }
      if (active?.id === id) return true
      clear()
      active = { id, cancel, pause }
      return true
    },
    currentId(): string | undefined { return active?.id },
    stop(id: string) {
      if (active?.id === id) active = undefined
    },
    dispose() {
      doc?.removeEventListener('visibilitychange', visibility)
      listening = false
      clear()
    },
  }
}
export type DominantMotion = ReturnType<typeof createDominantMotion>

let sharedCoordinator: DominantMotion | undefined
/** All landing modules share this coordinator; call dispose on page unmount. */
export function dominantMotion(): DominantMotion {
  return sharedCoordinator ??= createDominantMotion()
}
export function disposeDominantMotion(): void {
  sharedCoordinator?.dispose()
  sharedCoordinator = undefined
}

export function whenVisible(el: Element, cb: Dispose): Dispose {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    cb()
    return () => {}
  }
  let finished = false
  const dispose = () => {
    if (finished) return
    finished = true
    observer.disconnect()
  }
  const observer = new IntersectionObserver((entries) => {
    if (finished || !entries.some((entry) => entry.target === el && entry.isIntersecting)) return
    dispose()
    cb()
  })
  observer.observe(el)
  return dispose
}

export interface RevealTimeline {
  pause(): unknown
  progress(value: number): unknown
}
export type ScrubDispose = Dispose & { readonly ready: Promise<void> }
let nextReveal = 0
let liveReveals = 0
let scrollTriggerSuspended = false
let tickerSleptByReveal = false

/** Immediate disposer covers the async import. Await ready to handle load errors.
 * The paused timeline is driven directly by ScrollTrigger's bidirectional
 * progress (scrub:true, no smoothing), so it cannot keep playing offscreen.
 */
export function scrubReveal(
  el: Element,
  timeline: RevealTimeline,
  coordinator = dominantMotion(),
): ScrubDispose {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    timeline.pause()
    timeline.progress(1)
    return Object.assign(() => {}, { ready: Promise.resolve() })
  }
  const id = `landing-reveal-${++nextReveal}`
  let disposed = false
  let trigger: { kill(): void } | undefined
  let release: Dispose | undefined
  const kill = () => {
    trigger?.kill()
    trigger = undefined
    release?.()
    release = undefined
  }
  const settle = () => {
    unlisten()
    coordinator.stop(id)
    timeline.pause()
    // GSAP progress() wakes its ticker; release globals after applying the endpoint.
    timeline.progress(1)
    kill()
  }
  timeline.pause()
  const unlisten = prefersReducedMotion((reduced) => { if (reduced) settle() })
  const dispose = () => {
    if (disposed) return
    disposed = true
    unlisten()
    coordinator.stop(id)
    timeline.pause()
    kill()
  }
  const ready = (async () => {
    if (prefersReducedMotion()) { settle(); return }
    const motion = await importRelayMotion()
    if (disposed) return
    if (prefersReducedMotion()) { settle(); return }
    motion.gsap.registerPlugin(motion.ScrollTrigger)
    if (scrollTriggerSuspended) {
      motion.ScrollTrigger.enable()
      scrollTriggerSuspended = false
    }
    if (tickerSleptByReveal) {
      tickerSleptByReveal = false
      motion.gsap.ticker.wake()
    }
    trigger = motion.ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      onToggle(self) {
        if (!self.isActive) { coordinator.stop(id); return }
        if (disposed || document.hidden || prefersReducedMotion()) return
        coordinator.start(id, () => timeline.pause(), () => timeline.pause())
      },
      onUpdate(self) {
        if (disposed || document.hidden || prefersReducedMotion()) return
        if (self.isActive) {
          const owner = coordinator.currentId()
          if (owner !== undefined && owner !== id) return
          coordinator.start(id, () => timeline.pause(), () => timeline.pause())
        } else coordinator.stop(id)
        timeline.progress(Math.max(0, Math.min(1, self.progress)))
      },
    })
    liveReveals++
    release = () => {
      liveReveals--
      // getAll deliberately omits ScrollSmoother's trigger; preserve that owner too.
      if (liveReveals || motion.ScrollTrigger.getAll().length || motion.ScrollTrigger.getById('ScrollSmoother')) return
      // ScrollTrigger owns a separate rAF loop and interval, independent of the ticker.
      motion.ScrollTrigger.disable()
      scrollTriggerSuspended = true
      // Never freeze foreign running or scheduled animations; GSAP wakes the ticker itself for new ones.
      // Pending (delayed) tweens report isActive() false but still need the ticker.
      if (motion.gsap.globalTimeline.getChildren(true, true, true).some((child) => !child.paused() && child.totalProgress() < 1)) return
      tickerSleptByReveal = true
      motion.gsap.ticker.sleep()
    }
  })()
  return Object.assign(dispose, { ready })
}
