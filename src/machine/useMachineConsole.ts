import { useCallback, useEffect, useReducer, type KeyboardEvent } from 'react'
import { type CartridgeIndex } from '../content/cartridges'
import {
  actionForExactProjectHash,
  createConsoleInitialState,
  elementIdForFocusRequest,
  resumePauseAction,
  routeConsoleKey,
  toggleUserPauseAction,
  type ConsoleKeyZone,
} from './consoleAdapter'
import { isEffectivelyPaused, transitionMachine } from './runtime'

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
    hash: window.location.hash,
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

  useEffect(() => {
    const onHashChange = () => {
      const action = actionForExactProjectHash(window.location.hash)
      if (action) dispatch(action)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => {
      dispatch({
        type: 'set-document-hidden',
        hidden: document.hidden,
      })
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

    target.focus()
    if (document.activeElement === target) {
      dispatch({ type: 'clear-focus-request' })
    }
  }, [state.focusRequest])

  const selectCartridge = useCallback((index: CartridgeIndex) => {
    dispatch({ type: 'select-cartridge', index })
  }, [])

  const openProject = useCallback((index: CartridgeIndex) => {
    dispatch({ type: 'direct-project', index })
  }, [])

  const activateModule = useCallback(() => {
    dispatch({ type: 'activate-module' })
  }, [])

  const skipMachine = useCallback(() => {
    dispatch({ type: 'skip-machine' })
  }, [])

  const resumeFromSkip = useCallback(() => {
    dispatch(resumePauseAction('skip'))
    window.requestAnimationFrame(() => {
      document.getElementById('cartridge-handle')?.focus()
    })
  }, [])

  const toggleUserPause = useCallback(() => {
    dispatch(toggleUserPauseAction(state))
  }, [state])

  const onConsoleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const route = routeConsoleKey(event.key, keyZoneForTarget(event.target))
      if (!route) return
      if (route.preventDefault) event.preventDefault()
      dispatch(route.action)
    },
    [],
  )

  return {
    state,
    effectivelyPaused: isEffectivelyPaused(state),
    selectCartridge,
    openProject,
    activateModule,
    skipMachine,
    resumeFromSkip,
    toggleUserPause,
    onConsoleKeyDown,
  }
}
