export type MotionMode = 'continuous' | 'discrete'

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

export function presentProgress(
  progress: number,
  stopCount: number,
  reducedMotion: boolean,
): { progress: number; mode: MotionMode } {
  const clamped = clamp(progress)
  if (!reducedMotion || stopCount < 2) {
    return { progress: clamped, mode: 'continuous' }
  }

  const lastStop = stopCount - 1
  return {
    progress: Math.round(clamped * lastStop) / lastStop,
    mode: 'discrete',
  }
}
