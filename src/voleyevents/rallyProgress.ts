export interface RallyLandingMeasurement {
  readonly id: string
  readonly top: number
}

export interface RallyStaircaseMeasurements {
  readonly landings: readonly RallyLandingMeasurement[]
  /** Viewport-relative top of the non-sticky `[data-rally-root]` anchor. */
  readonly rootTop: number
  readonly viewportHeight: number
  readonly documentMaximumScroll: number
  readonly scrollY: number
}

export interface RallyLanding {
  readonly id: string
  readonly index: number
  readonly start: number
  readonly progress: number
}

export interface RallyState {
  readonly id: string
  readonly index: number
  /** Global route progress, not progress local to the selected landing. */
  readonly progress: number
}

export interface RallyStaircase {
  readonly origin: number
  readonly end: number
  readonly landings: readonly RallyLanding[]
  progressFor(scrollY: number): number
  stateFor(scrollY: number): RallyState
}

function finiteCoordinate(value: number) {
  return Number.isFinite(value) ? value : 0
}

function nonNegativeExtent(value: number) {
  return Math.max(0, finiteCoordinate(value))
}

/**
 * Converts viewport-relative landing measurements into one history-free
 * native-scroll model. A landing activates when its top reaches the viewport
 * midpoint. The origin comes from the non-sticky route root, so converting its
 * viewport position to document space remains stable after the stage sticks.
 * Semantic order wins if measurements descend; at equal thresholds, the later
 * landing wins.
 */
export function measureRallyStaircase(
  measurements: RallyStaircaseMeasurements,
): RallyStaircase {
  if (measurements.landings.length !== 4) {
    throw new Error('Rally staircase requires exactly four landings.')
  }

  const measuredScrollY = finiteCoordinate(measurements.scrollY)
  const origin = finiteCoordinate(measurements.rootTop) + measuredScrollY
  const end = Math.max(
    origin,
    nonNegativeExtent(measurements.documentMaximumScroll),
  )
  const viewportMidpoint = nonNegativeExtent(measurements.viewportHeight) / 2
  const interval = end - origin

  const progressFor = (scrollY: number) => {
    if (interval <= 0) return 0
    const progress = (finiteCoordinate(scrollY) - origin) / interval
    return Math.min(1, Math.max(0, progress))
  }

  let previousStart = origin
  const landings = Object.freeze(
    measurements.landings.map(({ id, top }, landingIndex) => {
      const documentTop = finiteCoordinate(top) + measuredScrollY
      const measuredStart = documentTop - viewportMidpoint
      const reachableStart = Math.min(
        end,
        Math.max(origin, measuredStart),
      )
      const start = Math.max(previousStart, reachableStart)
      previousStart = start

      return Object.freeze({
        id,
        index: landingIndex + 1,
        start,
        progress: progressFor(start),
      })
    }),
  )

  const stateFor = (scrollY: number): RallyState => {
    const position = finiteCoordinate(scrollY)
    const progress = progressFor(position)

    let selected: RallyLanding | undefined
    for (const landing of landings) {
      if (landing.start <= position) selected = landing
    }

    return Object.freeze(
      selected
        ? { id: selected.id, index: selected.index, progress }
        : { id: 'serve', index: 0, progress },
    )
  }

  return Object.freeze({ origin, end, landings, progressFor, stateFor })
}
