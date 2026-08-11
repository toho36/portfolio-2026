export interface RelayBeatMeasurement {
  readonly id: string
  readonly top: number
}

export interface ResolvedRelayBeat {
  readonly id: string
  readonly index: number
  readonly start: number
  readonly seekTarget: number
}

export interface RelayBeatResolver {
  readonly beats: readonly ResolvedRelayBeat[]
  readonly maxScroll: number
  classify(scrollY: number): ResolvedRelayBeat
  seekTargetFor(id: string): number
}

function normalizeCoordinate(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Resolves measured beat tops and native-scroll classification through the
 * same unrounded CSS-pixel coordinates.
 *
 * The first seek target must be zero, ensuring every normalized coordinate has
 * an eligible beat and classifying the selected target always returns the same
 * beat. A beat round-trips by id only when its measured start is reachable and
 * unique among the seek targets.
 */
export function resolveRelayBeats(
  measurements: readonly RelayBeatMeasurement[],
  maxScroll: number,
): RelayBeatResolver {
  if (measurements.length === 0) {
    throw new Error('Relay beats require at least one measurement.')
  }

  const normalizedMaxScroll = normalizeCoordinate(maxScroll)
  const beats: readonly ResolvedRelayBeat[] = measurements.map(
    ({ id, top }, index) => {
      const start = normalizeCoordinate(top)

      return {
        id,
        index,
        start,
        seekTarget: Math.min(start, normalizedMaxScroll),
      }
    },
  )

  if (beats[0].seekTarget !== 0) {
    throw new Error('The first relay beat must have a zero seek target.')
  }

  return {
    beats,
    maxScroll: normalizedMaxScroll,
    classify(scrollY) {
      const clampedY = Math.min(
        normalizeCoordinate(scrollY),
        normalizedMaxScroll,
      )
      let selected = beats[0]

      for (const beat of beats) {
        if (beat.seekTarget <= clampedY) selected = beat
      }

      return selected
    },
    seekTargetFor(id) {
      const beat = beats.find((candidate) => candidate.id === id)

      if (!beat) throw new Error(`Unknown relay beat id: ${id}`)
      return beat.seekTarget
    },
  }
}
