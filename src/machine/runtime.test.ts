import { describe, expect, it } from 'vitest'
import {
  SLOT,
  initialAssemblyState,
  moveModule,
  nudgeModule,
  releaseModule,
  seatModule,
} from '../loops/assembly/model'
import { conveyorStop } from '../loops/conveyor/model'
import { timelineStop } from '../loops/timeline/model'
import {
  createMachineState,
  isEffectivelyPaused,
  machineActionForKey,
  presentMachineProgress,
  reconcileStops,
  shouldRegressQuality,
  transitionMachine,
} from './runtime'

describe('machine runtime identity and reconciliation', () => {
  it('initializes direct project intent for all four public hashes', () => {
    const hashes = [
      '#project-gameonvb',
      '#project-suburbs',
      '#project-screen-switch',
      '#project-voleyevents',
    ] as const

    hashes.forEach((hash, index) => {
      const state = createMachineState({ hash })
      expect(state.selectedCartridge).toBe(index)
      expect(state.committedCartridge).toBe(0)
      expect(state.pendingSeek.conveyor).toBe(index === 0 ? null : index)
      expect(state.selectionAuthority).toBe('direct-link')
      expect(state.focusRequest).toEqual({ kind: 'project', cartridge: index })
    })

    const transitioned = transitionMachine(createMachineState(), {
      type: 'direct-project',
      index: 3,
    })
    expect(transitioned.selectedCartridge).toBe(3)
    expect(transitioned.pendingSeek.conveyor).toBe(3)
  })

  it('keeps direct-link authority through zero and intermediate scroll until acknowledgement', () => {
    const direct = createMachineState({ hash: '#project-screen-switch' })
    expect(reconcileStops(direct, { conveyorProgress: 0 })).toBe(direct)

    const intermediate = reconcileStops(direct, {
      conveyorProgress: conveyorStop(1),
    })
    expect(intermediate.selectedCartridge).toBe(2)
    expect(intermediate.committedCartridge).toBe(0)
    expect(intermediate.selectionAuthority).toBe('direct-link')
    expect(intermediate.pendingSeek.conveyor).toBe(2)

    const acknowledged = reconcileStops(intermediate, {
      conveyorProgress: conveyorStop(2),
    })
    expect(acknowledged.selectedCartridge).toBe(2)
    expect(acknowledged.committedCartridge).toBe(2)
    expect(acknowledged.selectionAuthority).toBe('scroll')
    expect(acknowledged.pendingSeek.conveyor).toBeNull()
  })

  it('honors explicit selection and stage seeks in both directions', () => {
    let state = createMachineState()
    state = transitionMachine(state, { type: 'select-cartridge', index: 3 })
    state = reconcileStops(state, { conveyorProgress: conveyorStop(3) })
    expect([state.selectedCartridge, state.committedCartridge]).toEqual([3, 3])

    state = transitionMachine(state, { type: 'select-cartridge', index: 1 })
    state = reconcileStops(state, { conveyorProgress: conveyorStop(1) })
    expect([state.selectedCartridge, state.committedCartridge]).toEqual([1, 1])

    state = transitionMachine(state, { type: 'set-stage-intent', index: 3 })
    state = reconcileStops(state, { timelineProgress: timelineStop(3) })
    expect([state.stageIntent, state.committedStage]).toEqual([3, 3])

    state = transitionMachine(state, { type: 'set-stage-intent', index: 1 })
    state = reconcileStops(state, { timelineProgress: timelineStop(1) })
    expect([state.stageIntent, state.committedStage]).toEqual([1, 1])
  })

  it('commits intent immediately when retargeting an observed intermediate stop', () => {
    const intermediateConveyor = reconcileStops(
      transitionMachine(createMachineState(), {
        type: 'select-cartridge',
        index: 3,
      }),
      { conveyorProgress: conveyorStop(1) },
    )

    const explicitlySelected = transitionMachine(intermediateConveyor, {
      type: 'select-cartridge',
      index: 1,
    })
    expect(explicitlySelected.selectedCartridge).toBe(1)
    expect(explicitlySelected.committedCartridge).toBe(1)
    expect(explicitlySelected.conveyor.progress).toBe(conveyorStop(1))
    expect(explicitlySelected.pendingSeek.conveyor).toBeNull()
    expect(explicitlySelected.selectionAuthority).toBe('explicit')
    expect(
      reconcileStops(explicitlySelected, {
        conveyorProgress: conveyorStop(1),
      }),
    ).toBe(explicitlySelected)

    const direct = transitionMachine(intermediateConveyor, {
      type: 'direct-project',
      index: 1,
    })
    expect(direct.selectedCartridge).toBe(1)
    expect(direct.committedCartridge).toBe(1)
    expect(direct.conveyor.progress).toBe(conveyorStop(1))
    expect(direct.pendingSeek.conveyor).toBeNull()
    expect(direct.selectionAuthority).toBe('direct-link')
    expect(direct.focusRequest).toEqual({ kind: 'project', cartridge: 1 })

    const intermediateTimeline = reconcileStops(
      transitionMachine(createMachineState(), {
        type: 'set-stage-intent',
        index: 3,
      }),
      { timelineProgress: timelineStop(1) },
    )
    const stage = transitionMachine(intermediateTimeline, {
      type: 'set-stage-intent',
      index: 1,
    })
    expect(stage.stageIntent).toBe(1)
    expect(stage.committedStage).toBe(1)
    expect(stage.timeline.progress).toBe(timelineStop(1))
    expect(stage.pendingSeek.timeline).toBeNull()
    expect(
      reconcileStops(stage, { timelineProgress: timelineStop(1) }),
    ).toBe(stage)
  })

  it('preserves reverse conveyor seeks when retargeted at an intermediate stop', () => {
    let state = transitionMachine(createMachineState(), {
      type: 'select-cartridge',
      index: 3,
    })
    state = reconcileStops(state, { conveyorProgress: conveyorStop(1) })
    expect(state.observedStops.conveyor).toBe(1)
    expect(state.committedCartridge).toBe(0)

    state = transitionMachine(state, { type: 'select-cartridge', index: 0 })
    expect(state.pendingSeek.conveyor).toBe(0)

    const unchangedIntermediate = reconcileStops(state, {
      conveyorProgress: conveyorStop(1),
    })
    expect(unchangedIntermediate).toBe(state)
    expect(unchangedIntermediate.pendingSeek.conveyor).toBe(0)

    const acknowledged = reconcileStops(unchangedIntermediate, {
      conveyorProgress: conveyorStop(0),
    })
    expect(acknowledged.committedCartridge).toBe(0)
    expect(acknowledged.pendingSeek.conveyor).toBeNull()
  })

  it('preserves reverse direct-link seeks from an intermediate stop', () => {
    let state = transitionMachine(createMachineState(), {
      type: 'direct-project',
      index: 3,
    })
    state = reconcileStops(state, { conveyorProgress: conveyorStop(1) })

    state = transitionMachine(state, { type: 'direct-project', index: 0 })
    expect(state.selectionAuthority).toBe('direct-link')
    expect(state.pendingSeek.conveyor).toBe(0)

    const unchangedIntermediate = reconcileStops(state, {
      conveyorProgress: conveyorStop(1),
    })
    expect(unchangedIntermediate).toBe(state)
    expect(unchangedIntermediate.pendingSeek.conveyor).toBe(0)

    const acknowledged = reconcileStops(unchangedIntermediate, {
      conveyorProgress: conveyorStop(0),
    })
    expect(acknowledged.selectedCartridge).toBe(0)
    expect(acknowledged.committedCartridge).toBe(0)
    expect(acknowledged.pendingSeek.conveyor).toBeNull()
  })

  it('preserves reverse timeline seeks when retargeted at an intermediate stop', () => {
    let state = transitionMachine(createMachineState(), {
      type: 'set-stage-intent',
      index: 3,
    })
    state = reconcileStops(state, { timelineProgress: timelineStop(1) })
    expect(state.observedStops.timeline).toBe(1)
    expect(state.committedStage).toBe(0)

    state = transitionMachine(state, { type: 'set-stage-intent', index: 0 })
    expect(state.pendingSeek.timeline).toBe(0)

    const unchangedIntermediate = reconcileStops(state, {
      timelineProgress: timelineStop(1),
    })
    expect(unchangedIntermediate).toBe(state)
    expect(unchangedIntermediate.pendingSeek.timeline).toBe(0)

    const acknowledged = reconcileStops(unchangedIntermediate, {
      timelineProgress: timelineStop(0),
    })
    expect(acknowledged.committedStage).toBe(0)
    expect(acknowledged.pendingSeek.timeline).toBeNull()
  })

  it('tracks conveyor and timeline stop changes independently', () => {
    let state = createMachineState()
    state = reconcileStops(state, { conveyorProgress: conveyorStop(1) })
    expect(state.observedStops).toEqual({ conveyor: 1, timeline: 0 })
    expect(state.committedCartridge).toBe(1)
    expect(state.committedStage).toBe(0)

    state = reconcileStops(state, { timelineProgress: timelineStop(3) })
    expect(state.observedStops).toEqual({ conveyor: 1, timeline: 3 })
    expect(state.committedCartridge).toBe(1)
    expect(state.committedStage).toBe(3)

    const unchanged = reconcileStops(state, {
      conveyorProgress: conveyorStop(1),
      timelineProgress: timelineStop(3),
    })
    expect(unchanged).toBe(state)
  })
})

describe('machine runtime assembly input', () => {
  it('delegates pointer movement and arrow nudges to the Assembly model', () => {
    const initial = createMachineState()
    const moved = transitionMachine(initial, {
      type: 'move-module',
      point: { x: 0.4, y: 0.7 },
    })
    expect(moved.assembly).toEqual(
      moveModule(initialAssemblyState, { x: 0.4, y: 0.7 }),
    )

    const arrows = {
      ArrowLeft: { type: 'nudge-module', dx: -0.05, dy: 0 },
      ArrowRight: { type: 'nudge-module', dx: 0.05, dy: 0 },
      ArrowUp: { type: 'nudge-module', dx: 0, dy: -0.05 },
      ArrowDown: { type: 'nudge-module', dx: 0, dy: 0.05 },
    } as const
    for (const [key, action] of Object.entries(arrows)) {
      expect(machineActionForKey(key)).toEqual(action)
    }
    expect(machineActionForKey('Escape')).toBeNull()

    expect(
      transitionMachine(initial, machineActionForKey('ArrowRight')!).assembly,
    ).toEqual(
      nudgeModule(initialAssemblyState, 0.05, 0),
    )
  })

  it('maps Enter, Space, and tap to the same seat/eject activation', () => {
    for (const key of ['Enter', ' ', 'Spacebar']) {
      const action = machineActionForKey(key)
      expect(action).toEqual({ type: 'activate-module' })
      expect(transitionMachine(createMachineState(), action!).assembly).toEqual(
        seatModule(initialAssemblyState),
      )
    }

    const tapped = transitionMachine(createMachineState(), {
      type: 'pointer-release',
      gesture: 'tap',
    })
    expect(tapped.assembly).toEqual(seatModule(initialAssemblyState))
  })

  it('uses canonical release for over-slot and outside-slot drags', () => {
    const initial = createMachineState()
    const overSlot = moveModule(initial.assembly, SLOT.center)
    const overSlotState = { ...initial, assembly: overSlot }
    const snapped = transitionMachine(overSlotState, {
      type: 'pointer-release',
      gesture: 'drag',
    })
    expect(snapped.assembly).toEqual(releaseModule(overSlot))
    expect(snapped.assembly.seated).toBe(true)
    expect(snapped.suppressNextTap).toBe(true)

    const outside = moveModule(initial.assembly, { x: 0.4, y: 0.1 })
    const missed = transitionMachine(
      { ...initial, assembly: outside },
      { type: 'pointer-release', gesture: 'drag' },
    )
    expect(missed.assembly).toEqual(releaseModule(outside))
    expect(missed.assembly.seated).toBe(false)
  })

  it('leaves cancel unchanged and suppresses exactly one later tap only', () => {
    const initial = createMachineState()
    expect(
      transitionMachine(initial, {
        type: 'pointer-release',
        gesture: 'cancel',
      }),
    ).toBe(initial)

    const overSlot = transitionMachine(
      { ...initial, assembly: moveModule(initial.assembly, SLOT.center) },
      { type: 'pointer-release', gesture: 'drag' },
    )
    const keyboard = transitionMachine(overSlot, { type: 'activate-module' })
    expect(keyboard.assembly).toEqual(seatModule(overSlot.assembly))
    expect(keyboard.suppressNextTap).toBe(true)

    const suppressed = transitionMachine(keyboard, {
      type: 'pointer-release',
      gesture: 'tap',
    })
    expect(suppressed.assembly).toBe(keyboard.assembly)
    expect(suppressed.suppressNextTap).toBe(false)

    const laterTap = transitionMachine(suppressed, {
      type: 'pointer-release',
      gesture: 'tap',
    })
    expect(laterTap.assembly).toEqual(seatModule(suppressed.assembly))
  })
})

describe('machine runtime pause, focus, and presentation intent', () => {
  it('keeps hidden, user, and Skip pause causes independent', () => {
    let state = createMachineState()
    state = transitionMachine(state, { type: 'set-user-paused', paused: true })
    state = transitionMachine(state, { type: 'set-document-hidden', hidden: true })
    state = transitionMachine(state, { type: 'set-user-paused', paused: false })
    expect(state.pauseCauses).toEqual({ user: false, hidden: true, skip: false })
    expect(isEffectivelyPaused(state)).toBe(true)

    state = transitionMachine(state, { type: 'skip-machine' })
    expect(state.focusRequest).toEqual({ kind: 'cartridge-list' })
    state = transitionMachine(state, { type: 'set-document-hidden', hidden: false })
    expect(state.pauseCauses.skip).toBe(true)
    expect(isEffectivelyPaused(state)).toBe(true)

    state = transitionMachine(state, { type: 'set-skip-paused', paused: false })
    expect(isEffectivelyPaused(state)).toBe(false)
  })

  it('records direct project and Skip focus as symbolic requests', () => {
    const direct = createMachineState({ hash: '#project-voleyevents' })
    expect(direct.focusRequest).toEqual({ kind: 'project', cartridge: 3 })
    expect(
      transitionMachine(direct, { type: 'clear-focus-request' }).focusRequest,
    ).toBeNull()
  })

  it('presents reduced motion through canonical discrete stops', () => {
    const continuous = presentMachineProgress(
      { conveyorProgress: 0.42, timelineProgress: 0.9 },
      false,
    )
    expect(continuous.conveyor.mode).toBe('continuous')
    expect(continuous.conveyor.progress).toBe(0.42)

    const reduced = presentMachineProgress(
      { conveyorProgress: 0.42, timelineProgress: 0.9 },
      true,
    )
    expect(reduced).toEqual({
      conveyor: { progress: 1 / 3, mode: 'discrete' },
      timeline: { progress: 1, mode: 'discrete' },
    })
  })

  it('requests adaptive regression only above minimum while active and over budget', () => {
    const base = {
      frameBudgetExceeded: true,
      effectivelyPaused: false,
      quality: 0.75,
      minimumQuality: 0.5,
    }
    expect(shouldRegressQuality(base)).toBe(true)
    expect(
      shouldRegressQuality({ ...base, frameBudgetExceeded: false }),
    ).toBe(false)
    expect(shouldRegressQuality({ ...base, effectivelyPaused: true })).toBe(false)
    expect(shouldRegressQuality({ ...base, quality: 0.5 })).toBe(false)
    expect(shouldRegressQuality({ ...base, quality: 0.25 })).toBe(false)
  })
})
