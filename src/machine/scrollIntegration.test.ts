import { describe, expect, it, vi } from 'vitest'
import {
  createMachineScrollCoordinator,
  createPostHashReconciler,
  createPresentationBridge,
  focusMachineTarget,
  shouldReconcileSameHashClick,
  type PresentationValues,
  type ScrollCoordinatorDependencies,
} from './scrollIntegration'
import type { StageIndex } from './runtime'

function createCoordinatorHarness(paused = false) {
  const events: string[] = []
  const applied: PresentationValues[] = []
  let triggerProgress = 0
  let triggerUpdate: (progress: number) => void = () => {}
  let timelineUpdate: () => void = () => {}
  let proxy: { conveyorProgress: number; timelineProgress: number } | null = null

  const dependencies: ScrollCoordinatorDependencies = {
    createTimeline(values, onUpdate) {
      events.push('timeline:create')
      proxy = values as { conveyorProgress: number; timelineProgress: number }
      timelineUpdate = onUpdate
      return {
        setProgress(progress) {
          events.push(`timeline:${progress}`)
          proxy!.conveyorProgress = progress
          proxy!.timelineProgress = progress
          onUpdate()
        },
        kill() {
          events.push('timeline:kill')
        },
      }
    },
    createTrigger(_runway, onProgress) {
      events.push('trigger:create')
      triggerUpdate = onProgress
      return {
        start: 100,
        end: 400,
        get progress() {
          return triggerProgress
        },
        refresh() {
          events.push('trigger:refresh')
        },
        kill() {
          events.push('trigger:kill')
        },
      }
    },
    scrollTo(top) {
      events.push(`scroll:${top}`)
    },
  }

  const bridge = createPresentationBridge()
  bridge.attach({
    apply(values) {
      applied.push({ ...values })
      events.push(`bridge:${values.timelineProgress}`)
    },
  })

  const coordinator = createMachineScrollCoordinator(
    {
      runway: {} as HTMLElement,
      bridge,
      paused,
      reducedMotion: false,
      onConveyorStop: (index) => events.push(`conveyor:${index}`),
      onTimelineStop: (index) => events.push(`stage:${index}`),
    },
    dependencies,
  )

  return {
    coordinator,
    events,
    applied,
    emit(progress: number) {
      triggerProgress = progress
      triggerUpdate(progress)
    },
    updateProxy(conveyorProgress: number, timelineProgress: number) {
      proxy!.conveyorProgress = conveyorProgress
      proxy!.timelineProgress = timelineProgress
      timelineUpdate()
    },
  }
}

describe('native scroll coordinator', () => {
  it('creates a non-empty proxy timeline and trigger before the first seek', () => {
    const harness = createCoordinatorHarness()
    harness.coordinator.requestTarget(2)

    expect(harness.events.slice(1, 5)).toEqual([
      'timeline:create',
      'trigger:create',
      'scroll:300',
      `timeline:${2 / 3}`,
    ])
  })

  it('publishes continuous values forward and backward through one bridge', () => {
    const harness = createCoordinatorHarness()
    harness.emit(0.82)
    harness.emit(0.27)

    expect(harness.applied.slice(-2)).toEqual([
      { conveyorProgress: 0.82, timelineProgress: 0.82 },
      { conveyorProgress: 0.27, timelineProgress: 0.27 },
    ])
  })

  it('deduplicates conveyor and timeline observations independently', () => {
    const harness = createCoordinatorHarness()
    harness.events.length = 0

    harness.updateProxy(0.4, 0)
    harness.updateProxy(0.4, 0.4)
    harness.updateProxy(0.4, 0.4)

    expect(harness.events.filter((event) => event.startsWith('conveyor:')))
      .toEqual(['conveyor:1'])
    expect(harness.events.filter((event) => event.startsWith('stage:')))
      .toEqual(['stage:0', 'stage:1'])
  })

  it('retains only the latest paused target and seeks once on full resume', () => {
    const harness = createCoordinatorHarness()
    harness.events.length = 0
    harness.coordinator.setPaused(true)
    harness.emit(0.8)
    harness.coordinator.requestTarget(1)
    harness.coordinator.requestTarget(3)

    expect(harness.events.some((event) => event.startsWith('scroll:'))).toBe(false)
    expect(harness.events.some((event) => event.startsWith('timeline:'))).toBe(false)

    harness.coordinator.setPaused(false)
    expect(harness.events.filter((event) => event.startsWith('scroll:')))
      .toEqual(['scroll:400'])
    expect(harness.events.filter((event) => event.startsWith('timeline:')))
      .toEqual(['timeline:1'])
  })

  it('immediately re-presents the active proxy when reduced motion changes', () => {
    const harness = createCoordinatorHarness()
    harness.emit(0.4)

    harness.coordinator.setReducedMotion(true)
    expect(harness.applied.at(-1)).toEqual({
      conveyorProgress: 1 / 3,
      timelineProgress: 1 / 3,
    })

    harness.coordinator.setReducedMotion(false)
    expect(harness.applied.at(-1)).toEqual({
      conveyorProgress: 0.4,
      timelineProgress: 0.4,
    })
  })

  it('defers reduced-motion presentation changes while paused', () => {
    const harness = createCoordinatorHarness(true)
    const appliedBeforeChange = harness.applied.length
    harness.coordinator.setReducedMotion(true)
    expect(harness.applied).toHaveLength(appliedBeforeChange)
  })

  it('retains paused publications without replaying or invalidating', () => {
    const bridge = createPresentationBridge({
      conveyorProgress: 0.3,
      timelineProgress: 0.4,
    })
    const apply = vi.fn()
    bridge.setPaused(true)
    bridge.attach({ apply })
    bridge.publish({ conveyorProgress: 0.8, timelineProgress: 0.8 })
    expect(apply).not.toHaveBeenCalled()

    bridge.setPaused(false)
    bridge.replay()
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith({
      conveyorProgress: 0.8,
      timelineProgress: 0.8,
    })
  })

  it('retains and replays the latest active value when lazy Canvas attaches', () => {
    const bridge = createPresentationBridge()
    bridge.publish({ conveyorProgress: 0.25, timelineProgress: 0.75 })
    const apply = vi.fn()
    bridge.attach({ apply })
    expect(apply).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledWith({
      conveyorProgress: 0.25,
      timelineProgress: 0.75,
    })
  })

  it('replays the retained value after a Canvas target commits its resume', () => {
    const bridge = createPresentationBridge(undefined, true)
    let canvasPaused = true
    const committedApply = vi.fn()
    bridge.attach({
      apply(values) {
        if (!canvasPaused) committedApply(values)
      },
    })

    bridge.setPaused(false)
    bridge.publish({ conveyorProgress: 0.5, timelineProgress: 0.75 })
    expect(committedApply).not.toHaveBeenCalled()

    canvasPaused = false
    bridge.replay()
    expect(committedApply).toHaveBeenCalledOnce()
    expect(committedApply).toHaveBeenCalledWith({
      conveyorProgress: 0.5,
      timelineProgress: 0.75,
    })
  })

  it('kills its one trigger and timeline exactly once', () => {
    const harness = createCoordinatorHarness()
    harness.coordinator.destroy()
    harness.coordinator.destroy()
    expect(harness.events.filter((event) => event === 'trigger:kill')).toHaveLength(1)
    expect(harness.events.filter((event) => event === 'timeline:kill')).toHaveLength(1)
  })
})

describe('post-hash native ordering', () => {
  const hashes = [
    '#project-gameonvb',
    '#project-suburbs',
    '#project-screen-switch',
    '#project-voleyevents',
  ] as const

  it.each(hashes)('reconciles %s only on the frame after native navigation', (hash) => {
    const events: string[] = []
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrame = 0
    let currentHash = ''
    const reconciler = createPostHashReconciler({
      getHash: () => currentHash,
      indexForHash: (value) => {
        const index = hashes.indexOf(value as (typeof hashes)[number])
        return index < 0 ? null : index as StageIndex
      },
      requestFrame: (callback) => {
        nextFrame += 1
        frames.set(nextFrame, callback)
        return nextFrame
      },
      cancelFrame: (handle) => frames.delete(handle),
      refresh: () => events.push('refresh'),
      armGuard: (index) => events.push(`guard:${index}`),
      seek: (index) => events.push(`seek:${index}`),
      focus: (index, options) =>
        events.push(`focus:${index}:${String(options.preventScroll)}`),
    })

    currentHash = hash
    events.push(`native:${hash}`)
    reconciler.schedule()
    frames.get(nextFrame)?.(0)

    const index = hashes.indexOf(hash)
    expect(events).toEqual([
      `native:${hash}`,
      'refresh',
      `guard:${index}`,
      `seek:${index}`,
      `focus:${index}:true`,
    ])
  })

  it('coalesces click plus hashchange and still reconciles a same-hash click', () => {
    const events: string[] = []
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrame = 0
    const reconciler = createPostHashReconciler({
      getHash: () => '#project-gameonvb',
      indexForHash: () => 0,
      requestFrame: (callback) => {
        nextFrame += 1
        frames.set(nextFrame, callback)
        return nextFrame
      },
      cancelFrame: (handle) => frames.delete(handle),
      refresh: () => events.push('refresh'),
      armGuard: () => events.push('guard'),
      seek: () => events.push('seek'),
      focus: () => events.push('focus'),
    })

    reconciler.schedule()
    reconciler.schedule()
    expect(frames.size).toBe(1)
    frames.get(nextFrame)?.(0)
    expect(events).toEqual(['refresh', 'guard', 'seek', 'focus'])

    events.length = 0
    reconciler.schedule()
    frames.get(nextFrame)?.(0)
    expect(events).toEqual(['refresh', 'guard', 'seek', 'focus'])
  })

  it('captures the latest hidden hash and releases one resume seek after reconciliation', () => {
    const harness = createCoordinatorHarness(true)
    harness.events.length = 0
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrame = 0
    let currentHash: string = hashes[1]
    const reconciler = createPostHashReconciler({
      getHash: () => currentHash,
      indexForHash: (hash) => {
        const index = hashes.indexOf(hash as (typeof hashes)[number])
        return index < 0 ? null : index as StageIndex
      },
      requestFrame: (callback) => {
        nextFrame += 1
        frames.set(nextFrame, callback)
        return nextFrame
      },
      cancelFrame: (handle) => frames.delete(handle),
      refresh: () => harness.coordinator.refresh(),
      armGuard: (index) => harness.events.push(`guard:${index}`),
      seek: (index) => harness.coordinator.requestTarget(index),
      focus: (index) => harness.events.push(`focus:${index}`),
      onReconciled: () => harness.coordinator.setPaused(false),
    })

    reconciler.schedule()
    currentHash = hashes[3]
    reconciler.schedule()

    if (!reconciler.hasPending()) harness.coordinator.setPaused(false)
    expect(harness.events.some((event) => event.startsWith('scroll:'))).toBe(false)
    expect(harness.events.some((event) => event.startsWith('timeline:'))).toBe(false)

    frames.get(nextFrame)?.(0)
    expect(harness.events.filter((event) => event.startsWith('scroll:')))
      .toEqual(['scroll:400'])
    expect(harness.events.filter((event) => event.startsWith('timeline:')))
      .toEqual(['timeline:1'])
    expect(harness.events.indexOf('trigger:refresh')).toBeLessThan(
      harness.events.indexOf('guard:3'),
    )
    expect(harness.events.indexOf('guard:3')).toBeLessThan(
      harness.events.indexOf('scroll:400'),
    )
  })

  it('uses preventScroll only for hash reconciliation focus', () => {
    const focus = vi.fn()
    const target = { focus } as unknown as HTMLElement
    focusMachineTarget(target, true)
    focusMachineTarget(target, false)
    expect(focus.mock.calls).toEqual([[{ preventScroll: true }], []])
  })

  it('uses click reconciliation only for unmodified same-hash navigation', () => {
    const click = {
      altKey: false,
      button: 0,
      ctrlKey: false,
      defaultPrevented: false,
      metaKey: false,
      shiftKey: false,
    }

    expect(
      shouldReconcileSameHashClick(
        click,
        '#project-suburbs',
        '#project-suburbs',
      ),
    ).toBe(true)
    expect(
      shouldReconcileSameHashClick(
        click,
        '#project-gameonvb',
        '#project-suburbs',
      ),
    ).toBe(false)

    for (const modified of [
      { ...click, altKey: true },
      { ...click, button: 1 },
      { ...click, ctrlKey: true },
      { ...click, defaultPrevented: true },
      { ...click, metaKey: true },
      { ...click, shiftKey: true },
    ]) {
      expect(
        shouldReconcileSameHashClick(
          modified,
          '#project-suburbs',
          '#project-suburbs',
        ),
      ).toBe(false)
    }
  })
})
