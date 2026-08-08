import type { CartridgeSettleKind } from './cartridgeSettle'

interface CartridgeSettleFeedback {
  readonly scaleX: number
  readonly scaleY: number
  readonly scaleZ: number
  readonly slotOpacity: number
}

const STATIC_FEEDBACK: CartridgeSettleFeedback = Object.freeze({
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  slotOpacity: 0.3,
})

const FEEDBACK_AMPLITUDES = {
  seat: {
    scaleX: 0.06,
    scaleY: -0.05,
    scaleZ: 0.06,
    slotOpacity: 0.25,
  },
  return: {
    scaleX: 0.03,
    scaleY: -0.02,
    scaleZ: 0.03,
    slotOpacity: 0.12,
  },
} as const satisfies Record<CartridgeSettleKind, CartridgeSettleFeedback>

export function deriveCartridgeSettleFeedback(
  kind: CartridgeSettleKind,
  progress: number,
  reducedMotion: boolean,
): CartridgeSettleFeedback {
  const clampedProgress = Math.min(1, Math.max(0, progress))
  if (reducedMotion || clampedProgress === 0 || clampedProgress === 1) {
    return STATIC_FEEDBACK
  }

  const envelope = Math.sin(Math.PI * clampedProgress)
  const amplitude = FEEDBACK_AMPLITUDES[kind]
  return Object.freeze({
    scaleX: 1 + amplitude.scaleX * envelope,
    scaleY: 1 + amplitude.scaleY * envelope,
    scaleZ: 1 + amplitude.scaleZ * envelope,
    slotOpacity: 0.3 + amplitude.slotOpacity * envelope,
  })
}

export function cylinderSegmentsForDpr(dpr: number): number {
  return dpr <= 1 ? 12 : 24
}
