import type { Point } from '../loops/assembly/model'

export type CartridgeSettleKind = 'seat' | 'return'

export interface CartridgeSettlePolicy {
  readonly duration: number
  readonly ease: string
}

const POINT_EQUALITY_TOLERANCE = 1e-6

export function cartridgeSettlePolicy(
  kind: CartridgeSettleKind,
  reducedMotion: boolean,
): CartridgeSettlePolicy {
  const policy =
    kind === 'seat'
      ? { duration: 0.22, ease: 'back.out(1.35)' }
      : { duration: 0.18, ease: 'power2.out' }

  return reducedMotion ? { ...policy, duration: 0 } : policy
}

export function areCartridgeSettlePointsEqual(
  from: Point,
  to: Point,
): boolean {
  return (
    Math.abs(from.x - to.x) <= POINT_EQUALITY_TOLERANCE &&
    Math.abs(from.y - to.y) <= POINT_EQUALITY_TOLERANCE
  )
}
