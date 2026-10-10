import { duration, EASING, prefersReducedMotion, type DominantMotion } from '../shared/landingMotion'

export function createScreenSwitchController(
  root: HTMLElement,
  coordinator: DominantMotion,
  changed: (swapped: boolean, complete: boolean) => void,
) {
  const windows = Array.from(root.querySelectorAll<HTMLElement>('.landing-switch-window'))
  let swapped = root.dataset.swapped === 'true'
  let animations: Animation[] = []
  let generation = 0
  let disposed = false
  let visible = typeof IntersectionObserver === 'undefined'

  // Underlying CSS is already the complete target state; cancellation reveals it.
  const settle = () => {
    generation++
    const previous = animations
    animations = []
    for (const animation of previous) { animation.onfinish = null; animation.cancel() }
    coordinator.stop('switch')
    if (previous.length && !disposed) changed(swapped, true)
  }
  const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.target !== root) continue
      visible = entry.isIntersecting
      if (!visible) settle()
    }
  })
  observer?.observe(root)
  const unlisten = prefersReducedMotion((reduced) => { if (reduced) settle() })
  window.addEventListener('resize', settle)

  return {
    swap() {
      if (disposed || document.hidden || !visible) return
      settle()
      if (!coordinator.start('switch', settle)) return
      const before = windows.map((window) => window.getBoundingClientRect())
      swapped = !swapped
      root.dataset.swapped = String(swapped)
      const ms = duration('SWITCH_SWAP')
      if (!ms || windows.some((window) => typeof window.animate !== 'function')) {
        coordinator.stop('switch')
        changed(swapped, true)
        return
      }
      const after = windows.map((window) => window.getBoundingClientRect())
      animations = windows.map((window, index) => window.animate([
        { transform: `translate(${before[index].left - after[index].left}px, ${before[index].top - after[index].top}px)` },
        { transform: 'translate(0px, 0px)' },
      ], { duration: ms, easing: EASING }))
      // Both effects use the same document timeline timestamp, including after layout reads.
      const startTime = document.timeline.currentTime
      const current = generation
      let finished = 0
      for (const animation of animations) {
        animation.startTime = startTime
        animation.onfinish = () => {
          if (current !== generation) return
          if (++finished === windows.length) settle()
        }
      }
      changed(swapped, false)
    },
    dispose() {
      disposed = true
      settle()
      observer?.disconnect()
      unlisten()
      window.removeEventListener('resize', settle)
    },
  }
}
