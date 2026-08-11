import { loadSystemFieldRuntime } from './loadSystemFieldRuntime'
import {
  createSystemFieldRuntime,
  type SystemFieldRuntime,
  type SystemFieldThree,
} from './systemFieldRuntime'
import { normalizeSystemFieldProgress } from './systemFieldState'

export interface SystemFieldControllerOptions {
  readonly stage: HTMLElement
  readonly route: HTMLElement
  readonly media: MediaQueryList
  readonly window: Window
  readonly importThree?: () => Promise<unknown>
  /** Test seam; production always constructs the direct-Three runtime. */
  readonly createRuntime?: (
    three: unknown,
    onContextLoss: () => void,
  ) => SystemFieldRuntime
}

export interface SystemFieldController {
  setProgress(progress: number, settling: boolean): void
  resize(): void
  destroy(): void
}

export function createSystemFieldController(
  options: SystemFieldControllerOptions,
): SystemFieldController {
  const { media, route, stage, window: win } = options
  const previousState = route.dataset.systemField
  let generation = 0
  let pending: { canceled: boolean } | null = null
  let runtime: SystemFieldRuntime | null = null
  let progress = 0
  let settling = false
  let destroyed = false

  const isCurrent = (value: number) => value === generation

  function restoreFallback() {
    runtime?.destroy()
    runtime = null
    route.dataset.systemField = 'static'
  }

  function failToFallback(loadGeneration: number) {
    if (destroyed || !isCurrent(loadGeneration)) return
    generation += 1
    pending && (pending.canceled = true)
    pending = null
    restoreFallback()
  }

  function requestRuntime() {
    if (destroyed || media.matches) return
    const loadGeneration = ++generation
    const load = { canceled: false }
    pending = load
    route.dataset.systemField = 'loading'

    void loadSystemFieldRuntime({
      generation: loadGeneration,
      isCurrent,
      isCanceled: () => destroyed || load.canceled || media.matches,
      importThree: options.importThree,
      createRuntime: (module) => {
        const onContextLoss = () => failToFallback(loadGeneration)
        return options.createRuntime
          ? options.createRuntime(module, onContextLoss)
          : createSystemFieldRuntime({
              three: module as SystemFieldThree,
              route,
              stage,
              window: win,
              onContextLoss,
            })
      },
    }).then((result) => {
      if (result.status !== 'created') {
        if (pending === load) pending = null
        return
      }
      if (
        destroyed ||
        pending !== load ||
        load.canceled ||
        media.matches ||
        !isCurrent(loadGeneration)
      ) {
        if (pending === load) pending = null
        result.runtime.destroy()
        return
      }
      pending = null
      runtime = result.runtime
      route.dataset.systemField = 'ready'
      runtime.setProgress(progress, settling)
    }).catch(() => failToFallback(loadGeneration))
  }

  const applyMotionPreference = () => {
    generation += 1
    pending && (pending.canceled = true)
    pending = null
    restoreFallback()
    if (!destroyed && !media.matches) requestRuntime()
  }
  media.addEventListener('change', applyMotionPreference)

  if (media.matches) restoreFallback()
  else requestRuntime()

  return Object.freeze({
    setProgress(nextProgress: number, nextSettling: boolean) {
      if (destroyed) return
      progress = normalizeSystemFieldProgress(nextProgress)
      settling = nextSettling
      runtime?.setProgress(progress, settling)
    },
    resize() {
      runtime?.resize()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      generation += 1
      pending && (pending.canceled = true)
      pending = null
      media.removeEventListener('change', applyMotionPreference)
      runtime?.destroy()
      runtime = null
      if (previousState === undefined) {
        delete route.dataset.systemField
      } else {
        route.dataset.systemField = previousState
      }
    },
  })
}
