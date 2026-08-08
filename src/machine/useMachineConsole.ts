import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import {
  CARTRIDGE_IDENTITIES,
  cartridgeByHash,
  type CartridgeIndex,
} from '../content/cartridges'
import {
  createConsoleInitialState,
  elementIdForFocusRequest,
  resumePauseAction,
  routeConsoleKey,
  toggleUserPauseAction,
  type ConsoleKeyZone,
} from './consoleAdapter'
import {
  dispatchManipulationOutcome,
  type ManipulationTerminalCallback,
} from './manipulation'
import {
  createMachineScrollCoordinator,
  createPostHashReconciler,
  createPresentationBridge,
  focusMachineTarget,
  shouldReconcileSameHashClick,
  type MachineScrollCoordinator,
  type PostHashReconciler,
} from './scrollIntegration'
import {
  isEffectivelyPaused,
  transitionMachine,
  type MachineAction,
  type StageIndex,
} from './runtime'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function initialConsoleState() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return createConsoleInitialState({
      hash: '',
      reducedMotion: false,
      documentHidden: false,
    })
  }

  return createConsoleInitialState({
    // Exact hashes are reconciled only after the timeline and ScrollTrigger
    // exist. This keeps startup/reload ordering identical to hashchange.
    hash: '',
    reducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
    documentHidden: document.hidden,
  })
}

function keyZoneForTarget(target: EventTarget | null): ConsoleKeyZone {
  if (!(target instanceof Element)) return 'machine-control'
  if (target.closest('[data-machine-key-zone="cartridge-handle"]')) {
    return 'cartridge-handle'
  }
  return target.closest('a') ? 'native-link' : 'machine-control'
}

export function useMachineConsole() {
  const [state, dispatch] = useReducer(
    transitionMachine,
    undefined,
    initialConsoleState,
  )
  const stateRef = useRef(state)
  const runwayRef = useRef<HTMLElement | null>(null)
  const coordinatorRef = useRef<MachineScrollCoordinator | null>(null)
  const hashReconcilerRef = useRef<PostHashReconciler | null>(null)
  const deferredTargetRef = useRef<StageIndex | null>(null)
  const effectivelyPaused = isEffectivelyPaused(state)
  const [presentationBridge] = useState(() =>
    createPresentationBridge(undefined, effectivelyPaused),
  )

  stateRef.current = state

  useLayoutEffect(() => {
    const runway = runwayRef.current
    if (!runway) return

    const coordinator = createMachineScrollCoordinator({
      runway,
      bridge: presentationBridge,
      paused: isEffectivelyPaused(stateRef.current),
      reducedMotion: stateRef.current.reducedMotion,
      onConveyorStop: (index) => {
        dispatch({ type: 'observe-conveyor', index })
      },
      onTimelineStop: (index) => {
        dispatch({ type: 'observe-timeline', index })
      },
    })
    coordinatorRef.current = coordinator

    const reconciler = createPostHashReconciler({
      getHash: () => window.location.hash,
      indexForHash: (hash) => cartridgeByHash(hash)?.index ?? null,
      requestFrame: window.requestAnimationFrame.bind(window),
      cancelFrame: window.cancelAnimationFrame.bind(window),
      refresh: () => coordinator.refresh(),
      armGuard: (index) => {
        const action = { type: 'direct-project', index } as const
        stateRef.current = transitionMachine(stateRef.current, action)
        dispatch(action)
      },
      seek: (index) => coordinator.requestTarget(index),
      focus: (index, _options) => {
        const target = document.getElementById(
          elementIdForFocusRequest({ kind: 'project', cartridge: index }),
        )
        if (target) {
          focusMachineTarget(target, _options.preventScroll ?? false)
        }
      },
      onReconciled: () => {
        coordinator.setPaused(isEffectivelyPaused(stateRef.current))
      },
    })
    hashReconcilerRef.current = reconciler

    const deferredTarget = deferredTargetRef.current
    if (deferredTarget === null) {
      reconciler.schedule()
    } else {
      deferredTargetRef.current = null
      coordinator.refresh()
      coordinator.requestTarget(deferredTarget)
    }

    const onHashChange = () => reconciler.schedule()
    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener('hashchange', onHashChange)
      reconciler.destroy()
      coordinator.destroy()
      if (hashReconcilerRef.current === reconciler) {
        hashReconcilerRef.current = null
      }
      if (coordinatorRef.current === coordinator) coordinatorRef.current = null
    }
  }, [presentationBridge])

  useLayoutEffect(() => {
    // Resuming here lets descendant Canvas refs observe paused={false} before
    // the coordinator publishes its retained target or native position.
    if (!effectivelyPaused && hashReconcilerRef.current?.hasPending()) return
    coordinatorRef.current?.setPaused(effectivelyPaused)
  }, [effectivelyPaused])

  useLayoutEffect(() => {
    coordinatorRef.current?.setReducedMotion(state.reducedMotion)
  }, [state.reducedMotion])

  useEffect(() => {
    const onVisibilityChange = () => {
      const action: MachineAction = {
        type: 'set-document-hidden',
        hidden: document.hidden,
      }
      const next = transitionMachine(stateRef.current, action)
      stateRef.current = next
      if (isEffectivelyPaused(next)) {
        coordinatorRef.current?.setPaused(true)
      }
      dispatch(action)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY)
    const onChange = () => {
      dispatch({ type: 'set-reduced-motion', reduced: media.matches })
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!state.focusRequest) return
    const target = document.getElementById(
      elementIdForFocusRequest(state.focusRequest),
    )
    if (!target) return

    focusMachineTarget(target, state.focusRequest.kind === 'project')
    if (document.activeElement === target) {
      dispatch({ type: 'clear-focus-request' })
    }
  }, [state.focusRequest])

  const selectCartridge = useCallback((index: CartridgeIndex) => {
    const action = { type: 'select-cartridge', index } as const
    const next = transitionMachine(stateRef.current, action)
    stateRef.current = next
    coordinatorRef.current?.refresh()
    dispatch(action)
    if (coordinatorRef.current) {
      coordinatorRef.current.requestTarget(next.stageIntent)
    } else {
      deferredTargetRef.current = next.stageIntent
    }
  }, [])

  const openProject = useCallback(
    (index: CartridgeIndex, event: MouseEvent<HTMLAnchorElement>) => {
      // Changed hashes reconcile through hashchange after native navigation.
      // Only an unmodified same-hash activation needs the click fallback.
      if (
        shouldReconcileSameHashClick(
          event,
          window.location.hash,
          CARTRIDGE_IDENTITIES[index].hash,
        )
      ) {
        hashReconcilerRef.current?.schedule()
      }
    },
    [],
  )

  const moveStage = useCallback((direction: -1 | 1) => {
    const action = { type: 'move-stage-intent', direction } as const
    const next = transitionMachine(stateRef.current, action)
    stateRef.current = next
    coordinatorRef.current?.refresh()
    dispatch(action)
    if (coordinatorRef.current) {
      coordinatorRef.current.requestTarget(next.stageIntent)
    } else {
      deferredTargetRef.current = next.stageIntent
    }
  }, [])

  const previousStage = useCallback(() => moveStage(-1), [moveStage])
  const nextStage = useCallback(() => moveStage(1), [moveStage])

  const activateModule = useCallback(() => {
    dispatch({ type: 'activate-module' })
  }, [])

  const onManipulationOutcome = useCallback<ManipulationTerminalCallback>(
    (outcome) => {
      dispatchManipulationOutcome(dispatch, outcome)
    },
    [],
  )

  const skipMachine = useCallback(() => {
    const action = { type: 'skip-machine' } as const
    const next = transitionMachine(stateRef.current, action)
    stateRef.current = next
    coordinatorRef.current?.setPaused(true)
    dispatch(action)
  }, [])

  const resumeFromSkip = useCallback(() => {
    const action = resumePauseAction('skip')
    const next = transitionMachine(stateRef.current, action)
    stateRef.current = next
    dispatch(action)
    if (isEffectivelyPaused(next)) {
      coordinatorRef.current?.setPaused(true)
    }
    window.requestAnimationFrame(() => {
      const target = document.getElementById('cartridge-handle')
      if (target) focusMachineTarget(target, false)
    })
  }, [])

  const toggleUserPause = useCallback(() => {
    const action = toggleUserPauseAction(stateRef.current)
    const next = transitionMachine(stateRef.current, action)
    stateRef.current = next
    if (isEffectivelyPaused(next)) {
      coordinatorRef.current?.setPaused(true)
    }
    dispatch(action)
  }, [])

  const onConsoleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const route = routeConsoleKey(event.key, keyZoneForTarget(event.target))
      if (!route) return
      if (route.preventDefault) event.preventDefault()
      if (route.action.type === 'skip-machine') {
        const next = transitionMachine(stateRef.current, route.action)
        stateRef.current = next
        coordinatorRef.current?.setPaused(true)
      }
      dispatch(route.action)
    },
    [],
  )

  return {
    state,
    effectivelyPaused,
    runwayRef,
    presentationBridge,
    selectCartridge,
    openProject,
    previousStage,
    nextStage,
    activateModule,
    onManipulationOutcome,
    skipMachine,
    resumeFromSkip,
    toggleUserPause,
    onConsoleKeyDown,
  }
}
