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

export interface PendingSeek {
  readonly conveyor: CartridgeIndex | null
  readonly timeline: StageIndex | null
}

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
  readonly pendingSeek: PendingSeek
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

function directProjectIntent(
  state: MachineState,
  index: CartridgeIndex,
): MachineState {
  const alreadyObserved = state.observedStops.conveyor === index
  return {
    ...state,
    selectedCartridge: index,
    committedCartridge: alreadyObserved
      ? index
      : state.committedCartridge,
    selectionAuthority: 'direct-link',
    conveyor: alreadyObserved
      ? scrubConveyor(state.conveyor, conveyorStop(index))
      : state.conveyor,
    pendingSeek: {
      ...state.pendingSeek,
      conveyor: alreadyObserved ? null : index,
    },
    focusRequest: { kind: 'project', cartridge: index },
  }
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
    pendingSeek: { conveyor: null, timeline: null },
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
      const alreadyObserved = state.observedStops.conveyor === action.index
      return {
        ...state,
        selectedCartridge: action.index,
        committedCartridge: alreadyObserved
          ? action.index
          : state.committedCartridge,
        selectionAuthority: 'explicit',
        conveyor: alreadyObserved
          ? scrubConveyor(state.conveyor, conveyorStop(action.index))
          : state.conveyor,
        pendingSeek: {
          ...state.pendingSeek,
          conveyor: alreadyObserved ? null : action.index,
        },
      }
    }
    case 'direct-project':
      return directProjectIntent(state, action.index)
    case 'set-stage-intent': {
      const alreadyObserved = state.observedStops.timeline === action.index
      return {
        ...state,
        stageIntent: action.index,
        committedStage: alreadyObserved ? action.index : state.committedStage,
        timeline: alreadyObserved
          ? scrubTimeline(state.timeline, timelineStop(action.index))
          : state.timeline,
        pendingSeek: {
          ...state.pendingSeek,
          timeline: alreadyObserved ? null : action.index,
        },
      }
    }
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
  const conveyorChanged =
    conveyor !== null && conveyor !== state.observedStops.conveyor
  const timelineChanged =
    timeline !== null && timeline !== state.observedStops.timeline
  const conveyorAcknowledged =
    conveyor !== null && conveyor === state.pendingSeek.conveyor
  const timelineAcknowledged =
    timeline !== null && timeline === state.pendingSeek.timeline

  if (
    !conveyorChanged &&
    !timelineChanged &&
    !conveyorAcknowledged &&
    !timelineAcknowledged
  ) {
    return state
  }

  let next = state

  if (conveyor !== null && (conveyorChanged || conveyorAcknowledged)) {
    const pending = state.pendingSeek.conveyor
    if (pending === null || conveyor === pending) {
      next = {
        ...next,
        selectedCartridge: conveyor,
        committedCartridge: conveyor,
        selectionAuthority: 'scroll',
        conveyor: scrubConveyor(next.conveyor, conveyorStop(conveyor)),
        pendingSeek: {
          ...next.pendingSeek,
          conveyor: pending === conveyor ? null : pending,
        },
      }
    }
    if (conveyorChanged) {
      next = {
        ...next,
        observedStops: { ...next.observedStops, conveyor },
      }
    }
  }

  if (timeline !== null && (timelineChanged || timelineAcknowledged)) {
    const pending = state.pendingSeek.timeline
    if (pending === null || timeline === pending) {
      next = {
        ...next,
        stageIntent: timeline,
        committedStage: timeline,
        timeline: scrubTimeline(next.timeline, timelineStop(timeline)),
        pendingSeek: {
          ...next.pendingSeek,
          timeline: pending === timeline ? null : pending,
        },
      }
    }
    if (timelineChanged) {
      next = {
        ...next,
        observedStops: { ...next.observedStops, timeline },
      }
    }
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
