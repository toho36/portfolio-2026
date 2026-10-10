import { scrubReveal, type DominantMotion } from '../shared/landingMotion'

/** A paused, scroll-driven rail; labels stay readable at every position. */
export function mountGateReveal(section: HTMLElement, rail: HTMLElement, coordinator: DominantMotion) {
  const timeline = {
    pause() {},
    progress(value: number) { rail.style.transform = `scaleX(${value})` },
  }
  const dispose = scrubReveal(section, timeline, coordinator)
  // Keep the complete static rail if the optional animation runtime cannot load.
  void dispose.ready.catch(() => { dispose(); timeline.progress(1) })
  return dispose
}
