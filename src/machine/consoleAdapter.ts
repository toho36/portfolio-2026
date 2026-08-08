import { cartridgeByHash, CARTRIDGE_IDENTITIES, type CartridgeIndex } from '../content/cartridges'
import {
  createMachineState,
  machineActionForKey,
  transitionMachine,
  type FocusRequest,
  type MachineAction,
  type MachineState,
} from './runtime'

export type ConsoleKeyZone =
  | 'cartridge-handle'
  | 'machine-control'
  | 'native-link'

export interface ConsoleKeyRoute {
  readonly action: MachineAction
  readonly preventDefault: boolean
}

export type RendererPhase =
  | 'checking'
  | 'loading'
  | 'ready'
  | 'no-webgl'
  | 'lazy-error'
  | 'render-error'

export interface RendererPresentation {
  readonly label: string
  readonly detail: string
  readonly tone: 'working' | 'ready' | 'paused' | 'fallback'
}

export interface ConsoleInitialStateOptions {
  readonly hash: string
  readonly reducedMotion: boolean
  readonly documentHidden: boolean
}

export function createConsoleInitialState({
  hash,
  reducedMotion,
  documentHidden,
}: ConsoleInitialStateOptions): MachineState {
  const initial = createMachineState({ hash, reducedMotion })
  return documentHidden
    ? transitionMachine(initial, {
        type: 'set-document-hidden',
        hidden: true,
      })
    : initial
}

export function actionForExactProjectHash(hash: string): MachineAction | null {
  const cartridge = cartridgeByHash(hash)
  return cartridge
    ? { type: 'direct-project', index: cartridge.index }
    : null
}

export function projectElementId(index: CartridgeIndex): string {
  return CARTRIDGE_IDENTITIES[index].hash.slice(1)
}

export function elementIdForFocusRequest(request: FocusRequest): string {
  return request.kind === 'cartridge-list'
    ? 'cartridge-list'
    : projectElementId(request.cartridge)
}

export function routeConsoleKey(
  key: string,
  zone: ConsoleKeyZone,
): ConsoleKeyRoute | null {
  if (key === 'Escape') {
    return { action: { type: 'skip-machine' }, preventDefault: true }
  }
  if (zone !== 'cartridge-handle') return null

  const action = machineActionForKey(key)
  return action ? { action, preventDefault: true } : null
}

export function toggleUserPauseAction(state: MachineState): MachineAction {
  return {
    type: 'set-user-paused',
    paused: !state.pauseCauses.user,
  }
}

export function resumePauseAction(
  cause: 'user' | 'skip',
): MachineAction {
  return cause === 'user'
    ? { type: 'set-user-paused', paused: false }
    : { type: 'set-skip-paused', paused: false }
}

export function deriveRendererPresentation(
  phase: RendererPhase,
  effectivelyPaused: boolean,
  reducedMotion: boolean,
): RendererPresentation {
  switch (phase) {
    case 'checking':
      return {
        label: 'Checking renderer',
        detail: 'The native service console is ready now.',
        tone: 'working',
      }
    case 'loading':
      return {
        label: 'Starting viewport',
        detail: 'Project controls remain available while the preview loads.',
        tone: 'working',
      }
    case 'no-webgl':
      return {
        label: 'Native console active',
        detail: 'WebGL is unavailable; no project access is affected.',
        tone: 'fallback',
      }
    case 'lazy-error':
      return {
        label: 'Native console active',
        detail: 'The preview module did not load; use the controls below.',
        tone: 'fallback',
      }
    case 'render-error':
      return {
        label: 'Native console active',
        detail: 'The renderer stopped; project links remain available.',
        tone: 'fallback',
      }
    case 'ready':
      if (effectivelyPaused) {
        return {
          label: 'Machine paused',
          detail: 'The viewport is held; native controls stay operational.',
          tone: 'paused',
        }
      }
      if (reducedMotion) {
        return {
          label: 'Reduced motion',
          detail: 'The viewport is presented without continuous movement.',
          tone: 'ready',
        }
      }
      return {
        label: 'Renderer ready',
        detail: 'Native controls are primary; the viewport is presentational.',
        tone: 'ready',
      }
  }
}
