export type RallyQualityTier = 'Low' | 'Medium' | 'High'

export interface RallyQualityInputs {
  readonly reducedMotion: boolean | undefined
  readonly webglAvailable: boolean | undefined
  readonly webgl2Available: boolean | undefined
  readonly contextLost: boolean | undefined
  readonly pointerFine: boolean | undefined
  readonly viewportWidth: number | undefined
  readonly deviceMemory: number | undefined
  readonly hardwareConcurrency: number | undefined
}

export interface RallyCapability {
  readonly runtime: boolean
  readonly ceiling: RallyQualityTier
  readonly start: RallyQualityTier
  readonly coarsePointer: boolean
}

export interface RallyTierProfile {
  readonly dpr: number
  readonly waves: 1 | 2
  readonly courtSegments: 'low' | 'medium' | 'full'
  readonly ballSegments: readonly [width: number, height: number]
  readonly drawCalls: number
  readonly triangles: number
}

export const RALLY_TIER_PROFILES: Readonly<Record<RallyQualityTier, RallyTierProfile>> =
  Object.freeze({
    High: Object.freeze({
      dpr: 1.5,
      waves: 2,
      courtSegments: 'full',
      ballSegments: Object.freeze([24, 16]) as readonly [number, number],
      drawCalls: 18,
      triangles: 30_000,
    }),
    Medium: Object.freeze({
      dpr: 1.25,
      waves: 1,
      courtSegments: 'medium',
      ballSegments: Object.freeze([18, 12]) as readonly [number, number],
      drawCalls: 14,
      triangles: 20_000,
    }),
    Low: Object.freeze({
      dpr: 1,
      waves: 1,
      courtSegments: 'low',
      ballSegments: Object.freeze([12, 8]) as readonly [number, number],
      drawCalls: 10,
      triangles: 12_000,
    }),
  })

const WINDOW_MS = 2_000
const RECOVERY_MS = 5_000
const TIER_ORDER: readonly RallyQualityTier[] = ['Low', 'Medium', 'High']

function unavailable(value: unknown): value is undefined {
  return value === undefined
}

function knownNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value)
}

/** UA-free capability ceiling. Rules are deliberately ordered first-match. */
export function resolveRallyCapability(inputs: RallyQualityInputs): RallyCapability {
  const coarsePointer = inputs.pointerFine === false

  if (
    inputs.reducedMotion === true ||
    inputs.webglAvailable === false ||
    inputs.contextLost === true
  ) {
    return Object.freeze({ runtime: false, ceiling: 'Low', start: 'Low', coarsePointer })
  }

  if (
    coarsePointer ||
    (knownNumber(inputs.viewportWidth) && inputs.viewportWidth < 768) ||
    (knownNumber(inputs.deviceMemory) && inputs.deviceMemory <= 4) ||
    (knownNumber(inputs.hardwareConcurrency) && inputs.hardwareConcurrency <= 4)
  ) {
    return Object.freeze({ runtime: true, ceiling: 'Low', start: 'Low', coarsePointer })
  }

  if (
    unavailable(inputs.reducedMotion) ||
    unavailable(inputs.webglAvailable) ||
    unavailable(inputs.webgl2Available) ||
    unavailable(inputs.contextLost) ||
    unavailable(inputs.pointerFine) ||
    !knownNumber(inputs.viewportWidth) ||
    !knownNumber(inputs.deviceMemory) ||
    !knownNumber(inputs.hardwareConcurrency) ||
    inputs.webgl2Available === false ||
    inputs.viewportWidth < 1280 ||
    inputs.deviceMemory < 8 ||
    inputs.hardwareConcurrency < 8
  ) {
    return Object.freeze({ runtime: true, ceiling: 'Medium', start: 'Medium', coarsePointer })
  }

  return Object.freeze({ runtime: true, ceiling: 'High', start: 'Medium', coarsePointer })
}

export function rallyQualityThresholds(capability: RallyCapability) {
  return capability.coarsePointer
    ? Object.freeze({ target: 25, recovery: 19 })
    : Object.freeze({ target: 18, recovery: 14 })
}

export interface RallyQualityWindow {
  readonly startedAt: number
  readonly endedAt: number
  readonly p95: number
  readonly samples: number
  readonly tier: RallyQualityTier
}

export interface RallyQualityTransition {
  readonly at: number
  readonly from: RallyQualityTier
  readonly to: RallyQualityTier | 'Static'
  readonly reason: 'miss' | 'recovery' | 'surrender'
}

export interface RallyQualitySnapshot {
  readonly tier: RallyQualityTier
  readonly ceiling: RallyQualityTier
  readonly surrendered: boolean
  readonly windows: readonly RallyQualityWindow[]
  readonly transitions: readonly RallyQualityTransition[]
}

export interface RallyQualityUpdate {
  readonly tier: RallyQualityTier
  readonly surrender: boolean
  readonly window: RallyQualityWindow | null
  readonly transition: RallyQualityTransition | null
}

export interface RallyQualityController {
  sample(frameMs: number, timestamp?: number): RallyQualityUpdate
  /** Ends continuity after inactivity/visibility gaps without manufacturing empty windows. */
  resetSampling(timestamp?: number): void
  snapshot(): RallyQualitySnapshot
}

export interface RallyQualityControllerOptions {
  readonly capability: RallyCapability
  readonly target?: number
  readonly recovery?: number
  readonly now?: () => number
}

function nearestRankP95(samples: readonly number[]) {
  const ordered = [...samples].sort((left, right) => left - right)
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)]
}

function adjacentTier(tier: RallyQualityTier, direction: -1 | 1) {
  const index = TIER_ORDER.indexOf(tier)
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, Math.max(0, index + direction))]
}

export function createRallyQualityController(
  options: RallyQualityControllerOptions,
): RallyQualityController {
  if (!options.capability.runtime) {
    throw new TypeError('Rally quality controller requires a runtime-capable ceiling')
  }

  const defaults = rallyQualityThresholds(options.capability)
  const target = options.target ?? defaults.target
  const recovery = options.recovery ?? defaults.recovery
  const now = options.now ?? (() => 0)
  if (!Number.isFinite(target) || !Number.isFinite(recovery) || recovery >= target) {
    throw new TypeError('Rally quality thresholds require finite recovery < target')
  }

  let tier = options.capability.start
  let surrendered = false
  let windowStart: number | null = null
  let lastTimestamp: number | null = null
  let samples: number[] = []
  let missWindows = 0
  let lowMissWindows = 0
  let recoverySince: number | null = null
  let lastChangeAt = -Infinity
  const windows: RallyQualityWindow[] = []
  const transitions: RallyQualityTransition[] = []

  const resetEvidence = () => {
    missWindows = 0
    lowMissWindows = 0
    recoverySince = null
  }

  const transition = (
    at: number,
    to: RallyQualityTier | 'Static',
    reason: RallyQualityTransition['reason'],
  ) => {
    const entry = Object.freeze({ at, from: tier, to, reason })
    transitions.push(entry)
    if (to === 'Static') surrendered = true
    else tier = to
    lastChangeAt = at
    resetEvidence()
    return entry
  }

  const closeWindow = (endedAt: number) => {
    if (windowStart === null || samples.length === 0) {
      resetEvidence()
      return { window: null, transition: null }
    }

    const evidenceTier = tier
    const p95 = nearestRankP95(samples)
    const entry = Object.freeze({
      startedAt: windowStart,
      endedAt,
      p95,
      samples: samples.length,
      tier: evidenceTier,
    })
    windows.push(entry)
    let changed: RallyQualityTransition | null = null

    if (p95 > target) {
      recoverySince = null
      missWindows += 1
      if (evidenceTier === 'Low') {
        lowMissWindows += 1
        if (lowMissWindows >= 2) changed = transition(endedAt, 'Static', 'surrender')
      } else {
        lowMissWindows = 0
        if (missWindows >= 2) {
          changed = transition(endedAt, adjacentTier(evidenceTier, -1), 'miss')
        }
      }
    } else {
      // Exactly T/R is an intermediate pass: it resets miss/surrender evidence
      // but is not recovery evidence because recovery is strictly below R.
      missWindows = 0
      lowMissWindows = 0
      if (p95 < recovery) {
        recoverySince ??= windowStart
        const ceilingIndex = TIER_ORDER.indexOf(options.capability.ceiling)
        const tierIndex = TIER_ORDER.indexOf(tier)
        if (
          endedAt - recoverySince >= RECOVERY_MS &&
          endedAt - lastChangeAt >= RECOVERY_MS &&
          tierIndex < ceilingIndex
        ) {
          changed = transition(endedAt, adjacentTier(tier, 1), 'recovery')
        }
      } else {
        recoverySince = null
      }
    }

    return { window: entry, transition: changed }
  }

  const resetSampling = (timestamp = now()) => {
    const safeTimestamp = Number.isFinite(timestamp) ? timestamp : 0
    windowStart = safeTimestamp
    lastTimestamp = safeTimestamp
    samples = []
    resetEvidence()
  }

  return Object.freeze({
    sample(frameMs: number, timestamp = now()) {
      if (surrendered) {
        return { tier, surrender: true, window: null, transition: null }
      }
      if (!Number.isFinite(frameMs) || frameMs < 0 || !Number.isFinite(timestamp)) {
        return { tier, surrender: false, window: null, transition: null }
      }

      if (lastTimestamp !== null && timestamp < lastTimestamp) resetSampling(timestamp)
      if (windowStart === null) {
        windowStart = timestamp
      }

      let closed: RallyQualityWindow | null = null
      let changed: RallyQualityTransition | null = null
      for (;;) {
        const start = windowStart
        if (start === null || timestamp <= start + WINDOW_MS) break
        const boundary: number = start + WINDOW_MS
        const result = closeWindow(boundary)
        closed = result.window ?? closed
        changed = result.transition ?? changed
        samples = []
        windowStart = boundary
        if (surrendered) break
      }

      if (!surrendered) {
        samples.push(frameMs)
        // A sample exactly on a boundary closes the window it ends. Samples
        // beyond a boundary belong to the new window after empty-gap handling.
        const start = windowStart
        if (start !== null && timestamp === start + WINDOW_MS) {
          const boundary: number = start + WINDOW_MS
          const result = closeWindow(boundary)
          closed = result.window ?? closed
          changed = result.transition ?? changed
          samples = []
          windowStart = boundary
        }
      }
      lastTimestamp = timestamp
      return { tier, surrender: surrendered, window: closed, transition: changed }
    },
    resetSampling,
    snapshot() {
      return Object.freeze({
        tier,
        ceiling: options.capability.ceiling,
        surrendered,
        windows: Object.freeze([...windows]),
        transitions: Object.freeze([...transitions]),
      })
    },
  })
}
