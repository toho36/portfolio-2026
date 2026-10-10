import { scrubReveal, type DominantMotion } from '../shared/landingMotion'

/** A paused, scroll-driven rail; labels stay readable at every position. */
export function mountGateReveal(section: HTMLElement, rail: HTMLElement, coordinator: DominantMotion) {
  const timeline = {
    pause() {},
    progress(value: number) { rail.style.transform = `scaleX(${value})` },
  }
  return scrubReveal(section, timeline, coordinator)
}
