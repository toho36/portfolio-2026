import {
  loadRallyMotion,
  type RallyMotionFacade,
  type RallyMotionResult,
} from './loadRallyMotion'
import {
  loadRallyThree,
  type RallyThree,
  type RallyThreeResult,
} from './loadRallyThree'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export interface RallyRuntimeGate {
  issueGeneration(): number
  isCurrent(generation: number): boolean
}

export function createRallyRuntimeGate(): RallyRuntimeGate {
  let currentGeneration = 0

  return {
    issueGeneration() {
      currentGeneration += 1
      return currentGeneration
    },
    isCurrent(generation) {
      return generation === currentGeneration
    },
  }
}

export interface RallyElements {
  readonly root: HTMLElement
  readonly stage: HTMLElement
}

export interface RallyWindow {
  matchMedia(query: string): MediaQueryList
}

export interface RallyRuntimeParts {
  readonly elements: RallyElements
  readonly window?: RallyWindow
  readonly motion: RallyMotionFacade
  readonly three: RallyThree
}

export interface RallyRuntimeHandle {
  destroy(): void
}

export interface RallyRuntimeOwner {
  destroy(): void
}

export interface RallyRuntimeOwnerOptions {
  readonly elements: RallyElements
  readonly window?: RallyWindow
  readonly media?: MediaQueryList
  readonly importMotion?: () => Promise<unknown>
  readonly importThree?: () => Promise<unknown>
  readonly createRuntime?: (parts: RallyRuntimeParts) => RallyRuntimeHandle
}

function defaultRuntime(): RallyRuntimeHandle {
  return Object.freeze({ destroy() {} })
}

export function createRallyRuntimeOwner(
  options: RallyRuntimeOwnerOptions,
): RallyRuntimeOwner {
  const { elements } = options
  const mediaCandidate =
    options.media ?? options.window?.matchMedia(REDUCED_MOTION_QUERY)
  if (!mediaCandidate) {
    throw new TypeError('Rally runtime requires a reduced-motion query')
  }
  const media: MediaQueryList = mediaCandidate

  const previousState = elements.root.dataset.rallyRuntime
  const gate = createRallyRuntimeGate()
  let reduced = media.matches
  let pending: { canceled: boolean } | null = null
  let runtime: RallyRuntimeHandle | null = null
  let destroyed = false

  const isActive = (
    load: { canceled: boolean },
    generation: number,
  ) =>
    !destroyed &&
    pending === load &&
    !load.canceled &&
    !media.matches &&
    gate.isCurrent(generation)

  function destroyRuntime() {
    runtime?.destroy()
    runtime = null
  }

  function invalidateCurrent() {
    if (pending) pending.canceled = true
    pending = null
    gate.issueGeneration()
    destroyRuntime()
  }

  function requestRuntime() {
    if (destroyed || media.matches || pending || runtime) return

    const generation = gate.issueGeneration()
    const load = { canceled: false }
    pending = load
    elements.root.dataset.rallyRuntime = 'loading'
    const isCanceled = () =>
      destroyed || load.canceled || media.matches

    const motionLoad: Promise<RallyMotionResult<RallyMotionFacade>> =
      options.importMotion
        ? loadRallyMotion({
            generation,
            isCurrent: gate.isCurrent,
            isCanceled,
            importMotion: async () =>
              (await options.importMotion!()) as RallyMotionFacade,
            createRuntime: (motion) => motion,
          })
        : loadRallyMotion({
            generation,
            isCurrent: gate.isCurrent,
            isCanceled,
            createRuntime: (motion) => motion,
          })

    const threeLoad: Promise<RallyThreeResult<RallyThree>> =
      options.importThree
        ? loadRallyThree({
            generation,
            isCurrent: gate.isCurrent,
            isCanceled,
            importThree: options.importThree,
            createRuntime: (three) => three,
          })
        : loadRallyThree({
            generation,
            isCurrent: gate.isCurrent,
            isCanceled,
            createRuntime: (three) => three,
          })

    void Promise.allSettled([motionLoad, threeLoad]).then(
      ([motionSettlement, threeSettlement]) => {
        if (!isActive(load, generation)) return
        pending = null

        if (
          motionSettlement.status === 'rejected' ||
          threeSettlement.status === 'rejected' ||
          motionSettlement.value.status !== 'created' ||
          threeSettlement.value.status !== 'created'
        ) {
          elements.root.dataset.rallyRuntime = 'static'
          return
        }

        if (
          destroyed ||
          load.canceled ||
          media.matches ||
          !gate.isCurrent(generation)
        ) {
          return
        }

        try {
          runtime = (options.createRuntime ?? defaultRuntime)({
            elements,
            window: options.window,
            motion: motionSettlement.value.runtime,
            three: threeSettlement.value.runtime,
          })
          elements.root.dataset.rallyRuntime = 'ready'
        } catch {
          runtime = null
          elements.root.dataset.rallyRuntime = 'static'
        }
      },
    )
  }

  function applyMotionPreference() {
    if (destroyed || reduced === media.matches) return
    reduced = media.matches
    if (reduced) {
      invalidateCurrent()
      elements.root.dataset.rallyRuntime = 'static'
    } else {
      requestRuntime()
    }
  }

  media.addEventListener('change', applyMotionPreference)
  if (reduced) elements.root.dataset.rallyRuntime = 'static'
  else requestRuntime()

  return Object.freeze({
    destroy() {
      if (destroyed) return
      destroyed = true
      invalidateCurrent()
      media.removeEventListener('change', applyMotionPreference)
      if (previousState === undefined) {
        delete elements.root.dataset.rallyRuntime
      } else {
        elements.root.dataset.rallyRuntime = previousState
      }
    },
  })
}
