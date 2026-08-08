import {
  CARTRIDGE_IDENTITIES,
  CARTRIDGES,
  cartridgeByHash,
  type CartridgeIndex,
} from '../content/cartridges'
import {
  initialAssemblyState,
  moveModule,
  nudgeModule,
  releaseModule,
  seatModule,
  type AssemblyState,
  type Point,
} from '../loops/assembly/model'
import {
  conveyorIndex,
  conveyorStop,
  scrubConveyor,
  type ConveyorState,
} from '../loops/conveyor/model'
import {
  MACHINE_STAGES,
  initialTimelineState,
  scrubTimeline,
  timelineIndex,
  timelineStop,
  type TimelineState,
} from '../loops/timeline/model'
import { presentProgress, type MotionMode } from '../motion'

export type StageIndex = 0 | 1 | 2 | 3
export type SelectionAuthority = 'scroll' | 'explicit' | 'direct-link'

export interface ObservedStops {
  readonly conveyor: CartridgeIndex
  readonly timeline: StageIndex
}

export interface PauseCauses {
  readonly user: boolean
  readonly hidden: boolean
  readonly skip: boolean
}

export type FocusRequest =
  | { readonly kind: 'cartridge-list' }
  | { readonly kind: 'project'; readonly cartridge: CartridgeIndex }

export interface MachineState {
  readonly assembly: AssemblyState
  readonly selectedCartridge: CartridgeIndex
  readonly committedCartridge: CartridgeIndex
  readonly selectionAuthority: SelectionAuthority
  readonly stageIntent: StageIndex
  readonly committedStage: StageIndex
  readonly conveyor: ConveyorState
  readonly timeline: TimelineState
  readonly pendingSeek: StageIndex | null
  readonly observedStops: ObservedStops
  readonly pauseCauses: PauseCauses
  readonly focusRequest: FocusRequest | null
  readonly suppressNextTap: boolean
  readonly reducedMotion: boolean
}

export interface CreateMachineStateOptions {
  readonly hash?: string
  readonly reducedMotion?: boolean
}

export type PointerReleaseGesture = 'tap' | 'drag' | 'cancel'

export type MachineAction =
  | { readonly type: 'select-cartridge'; readonly index: CartridgeIndex }
  | { readonly type: 'direct-project'; readonly index: CartridgeIndex }
  | { readonly type: 'set-stage-intent'; readonly index: StageIndex }
  | { readonly type: 'move-stage-intent'; readonly direction: -1 | 1 }
  | { readonly type: 'observe-conveyor'; readonly index: CartridgeIndex }
  | { readonly type: 'observe-timeline'; readonly index: StageIndex }
  | { readonly type: 'move-module'; readonly point: Point }
  | {
      readonly type: 'nudge-module'
      readonly dx: number
      readonly dy: number
    }
  | {
      readonly type: 'pointer-release'
      readonly gesture: PointerReleaseGesture
    }
  | { readonly type: 'activate-module' }
  | { readonly type: 'set-user-paused'; readonly paused: boolean }
  | { readonly type: 'set-document-hidden'; readonly hidden: boolean }
  | { readonly type: 'set-skip-paused'; readonly paused: boolean }
  | { readonly type: 'skip-machine' }
  | { readonly type: 'clear-focus-request' }
  | { readonly type: 'set-reduced-motion'; readonly reduced: boolean }

const INITIAL_CONVEYOR: ConveyorState = { progress: 0 }
const INITIAL_PAUSE_CAUSES: PauseCauses = {
  user: false,
  hidden: false,
  skip: false,
}

function requestStageIntent(
  state: MachineState,
  index: StageIndex,
  authority: SelectionAuthority,
  focusRequest: FocusRequest | null = state.focusRequest,
): MachineState {
  return {
    ...state,
    selectedCartridge: index,
    stageIntent: index,
    selectionAuthority: authority,
    pendingSeek: index,
    focusRequest,
  }
}

function directProjectIntent(
  state: MachineState,
  index: CartridgeIndex,
): MachineState {
  return requestStageIntent(state, index, 'direct-link')
}

export function createMachineState(
  options: CreateMachineStateOptions = {},
): MachineState {
  const state: MachineState = {
    assembly: initialAssemblyState,
    selectedCartridge: 0,
    committedCartridge: 0,
    selectionAuthority: 'scroll',
    stageIntent: 0,
    committedStage: 0,
    conveyor: INITIAL_CONVEYOR,
    timeline: initialTimelineState,
    pendingSeek: null,
    observedStops: { conveyor: 0, timeline: 0 },
    pauseCauses: INITIAL_PAUSE_CAUSES,
    focusRequest: null,
    suppressNextTap: false,
    reducedMotion: options.reducedMotion ?? false,
  }

  const directProject = options.hash
    ? cartridgeByHash(options.hash)
    : undefined
  return directProject
    ? directProjectIntent(state, directProject.index)
    : state
}

function setPauseCause(
  state: MachineState,
  cause: keyof PauseCauses,
  paused: boolean,
): MachineState {
  if (state.pauseCauses[cause] === paused) return state
  return {
    ...state,
    pauseCauses: { ...state.pauseCauses, [cause]: paused },
  }
}

export function transitionMachine(
  state: MachineState,
  action: MachineAction,
): MachineState {
  switch (action.type) {
    case 'select-cartridge': {
      return requestStageIntent(state, action.index, 'explicit')
    }
    case 'direct-project':
      return directProjectIntent(state, action.index)
    case 'set-stage-intent':
      return requestStageIntent(state, action.index, 'explicit')
    case 'move-stage-intent': {
      const index = Math.min(
        MACHINE_STAGES.length - 1,
        Math.max(0, state.stageIntent + action.direction),
      ) as StageIndex
      return requestStageIntent(state, index, 'explicit')
    }
    case 'observe-conveyor':
      return reconcileObservedStop(state, 'conveyor', action.index)
    case 'observe-timeline':
      return reconcileObservedStop(state, 'timeline', action.index)
    case 'move-module':
      return { ...state, assembly: moveModule(state.assembly, action.point) }
    case 'nudge-module':
      return {
        ...state,
        assembly: nudgeModule(state.assembly, action.dx, action.dy),
      }
    case 'activate-module':
      return { ...state, assembly: seatModule(state.assembly) }
    case 'pointer-release':
      if (action.gesture === 'cancel') return state
      if (action.gesture === 'drag') {
        return {
          ...state,
          assembly: releaseModule(state.assembly),
          suppressNextTap: true,
        }
      }
      if (state.suppressNextTap) {
        return { ...state, suppressNextTap: false }
      }
      return { ...state, assembly: seatModule(state.assembly) }
    case 'set-user-paused':
      return setPauseCause(state, 'user', action.paused)
    case 'set-document-hidden':
      return setPauseCause(state, 'hidden', action.hidden)
    case 'set-skip-paused':
      return setPauseCause(state, 'skip', action.paused)
    case 'skip-machine':
      return {
        ...state,
        pauseCauses: { ...state.pauseCauses, skip: true },
        focusRequest: { kind: 'cartridge-list' },
      }
    case 'clear-focus-request':
      return state.focusRequest === null
        ? state
        : { ...state, focusRequest: null }
    case 'set-reduced-motion':
      return state.reducedMotion === action.reduced
        ? state
        : { ...state, reducedMotion: action.reduced }
  }
}

const NUDGE_STEP = 0.05

export function machineActionForKey(key: string): MachineAction | null {
  switch (key) {
    case 'ArrowLeft':
      return { type: 'nudge-module', dx: -NUDGE_STEP, dy: 0 }
    case 'ArrowRight':
      return { type: 'nudge-module', dx: NUDGE_STEP, dy: 0 }
    case 'ArrowUp':
      return { type: 'nudge-module', dx: 0, dy: -NUDGE_STEP }
    case 'ArrowDown':
      return { type: 'nudge-module', dx: 0, dy: NUDGE_STEP }
    case 'Enter':
    case ' ':
    case 'Spacebar':
      return { type: 'activate-module' }
    default:
      return null
  }
}

function asCartridgeIndex(index: number): CartridgeIndex {
  return index as CartridgeIndex
}

function asStageIndex(index: number): StageIndex {
  return index as StageIndex
}

export interface StopObservation {
  readonly conveyorProgress?: number
  readonly timelineProgress?: number
}

function reconcileObservedStop(
  state: MachineState,
  channel: keyof ObservedStops,
  index: StageIndex,
): MachineState {
  const changed = state.observedStops[channel] !== index
  const settlesGuard =
    channel === 'timeline' && state.pendingSeek === index

  if (!changed && !settlesGuard) return state

  let next = changed
    ? {
        ...state,
        observedStops: { ...state.observedStops, [channel]: index },
      }
    : state

  if (state.pendingSeek !== null) {
    if (!settlesGuard) return next
  }

  next = {
    ...next,
    selectedCartridge: index,
    committedCartridge: index,
    selectionAuthority: 'scroll',
    stageIntent: index,
    committedStage: index,
    conveyor: scrubConveyor(next.conveyor, conveyorStop(index)),
    timeline: scrubTimeline(next.timeline, timelineStop(index)),
    pendingSeek: null,
  }

  return next
}

export function reconcileStops(
  state: MachineState,
  observation: StopObservation,
): MachineState {
  const conveyor =
    observation.conveyorProgress === undefined
      ? null
      : asCartridgeIndex(conveyorIndex(observation.conveyorProgress))
  const timeline =
    observation.timelineProgress === undefined
      ? null
      : asStageIndex(timelineIndex(observation.timelineProgress))
  let next = state

  if (conveyor !== null) {
    next = reconcileObservedStop(next, 'conveyor', conveyor)
  }
  if (timeline !== null) {
    next = reconcileObservedStop(next, 'timeline', timeline)
  }

  return next
}

export function isEffectivelyPaused(state: MachineState): boolean {
  return Object.values(state.pauseCauses).some(Boolean)
}

export interface MachineProgressInput {
  readonly conveyorProgress: number
  readonly timelineProgress: number
}

export interface PresentedProgress {
  readonly progress: number
  readonly mode: MotionMode
}

export interface MachineProgressPresentation {
  readonly conveyor: PresentedProgress
  readonly timeline: PresentedProgress
}

export function presentMachineProgress(
  progress: MachineProgressInput,
  reducedMotion: boolean,
): MachineProgressPresentation {
  return {
    conveyor: presentProgress(
      progress.conveyorProgress,
      CARTRIDGES.length,
      reducedMotion,
    ),
    timeline: presentProgress(
      progress.timelineProgress,
      MACHINE_STAGES.length,
      reducedMotion,
    ),
  }
}

export interface AdaptiveRegressionInput {
  readonly frameBudgetExceeded: boolean
  readonly effectivelyPaused: boolean
  readonly quality: number
  readonly minimumQuality: number
}

export function shouldRegressQuality({
  frameBudgetExceeded,
  effectivelyPaused,
  quality,
  minimumQuality,
}: AdaptiveRegressionInput): boolean {
  return (
    frameBudgetExceeded &&
    !effectivelyPaused &&
    quality > minimumQuality
  )
}

export { CARTRIDGE_IDENTITIES }
