/** Motion durations in milliseconds. */
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
/** Scroll events schedule one update; a mounted reveal has no idle frame loop. */
export function scrubReveal(
  el: Element,
  timeline: RevealTimeline,
  coordinator = dominantMotion(),
): ScrubDispose {
  timeline.pause()
  if (typeof window === 'undefined' || typeof document === 'undefined' || prefersReducedMotion()) {
    timeline.progress(1)
    return Object.assign(() => {}, { ready: Promise.resolve() })
  }
  const id = `landing-reveal-${++nextReveal}`
  let disposed = false
  let frame: number | undefined
  let scrolling = false
  const cancelFrame = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    scrolling = false
  }
  const update = (duringScroll: boolean) => {
    if (disposed || document.hidden) return
    const rect = el.getBoundingClientRect()
    const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)))
    if (progress > 0 && progress < 1) {
      const owner = coordinator.currentId()
      if (duringScroll && owner !== undefined && owner !== id) return
      if (duringScroll) coordinator.start(id, () => timeline.pause(), () => timeline.pause())
    } else coordinator.stop(id)
    timeline.progress(progress)
  }
  const schedule = (event: Event) => {
    if (disposed || document.hidden) return
    scrolling ||= event.type === 'scroll'
    if (frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      const duringScroll = scrolling
      scrolling = false
      update(duringScroll)
    })
  }
  const visibility = () => {
    if (!document.hidden) return
    cancelFrame()
    coordinator.stop(id)
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    document.removeEventListener('visibilitychange', visibility)
    unlisten()
    cancelFrame()
    coordinator.stop(id)
    timeline.pause()
  }
  const unlisten = prefersReducedMotion((reduced) => {
    if (!reduced) return
    dispose()
    timeline.progress(1)
  })
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  document.addEventListener('visibilitychange', visibility)
  update(false)
  return Object.assign(dispose, { ready: Promise.resolve() })
}
