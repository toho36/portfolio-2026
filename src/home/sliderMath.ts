const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function indexFromOffset(offset: number, width: number, count: number): number {
  return clamp(Math.round(offset / Math.max(width, 1)), 0, Math.max(count - 1, 0))
}

export function snapTarget(offset: number, velocity: number, width: number, count: number, dragDistance?: number): number {
  if (dragDistance !== undefined) {
    const current = indexFromOffset(offset - dragDistance, width, count)
    const direction = Math.abs(dragDistance) > width * .12 ? Math.sign(dragDistance)
      : Math.abs(velocity) > .3 ? Math.sign(velocity) : 0
    return clamp(current + direction, 0, Math.max(count - 1, 0))
  }
  const current = indexFromOffset(offset, width, count)
  if (Math.abs(velocity) <= .3) return current
  return clamp(velocity > 0 ? Math.floor(offset / Math.max(width, 1)) + 1 : Math.ceil(offset / Math.max(width, 1)) - 1, 0, count - 1)
}

export function bendFromVelocity(velocity: number, max = 0.35): number {
  return max * Math.tanh(velocity)
}

export function overlapState(progress: number) {
  const p = clamp(progress, 0, 1)
  return { outScale: 1 - p * 0.08, outDim: 1 - p * 0.4, inX: 1 - p }
}

export function createWheelIntent(opts: { threshold?: number; cooldownMs?: number } = {}) {
  const threshold = opts.threshold ?? 60
  const cooldown = opts.cooldownMs ?? 650
  let accumulated = 0
  let lastInput = -Infinity
  let lockedUntil = -Infinity
  return (deltaY: number, deltaX: number, now: number): -1 | 0 | 1 => {
    if (now - lastInput > 180) accumulated = 0
    lastInput = now
    if (now < lockedUntil) return 0
    const delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX
    if (Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0
    accumulated += delta
    if (Math.abs(accumulated) < threshold) return 0
    const direction = Math.sign(accumulated) as -1 | 1
    accumulated = 0
    lockedUntil = now + cooldown
    return direction
  }
}

export const isClick = (dragDistancePx: number) => dragDistancePx <= 6
