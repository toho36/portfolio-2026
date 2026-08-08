import { isValidElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  bindAdaptiveDprActivity,
  createAdaptiveDprController,
  createResumeActivityGate,
  type AdaptiveActivityTarget,
  type ResumeFrameScheduler,
} from './adaptiveDpr'

const hookHarness = vi.hoisted(() => {
  type RefSlot = { readonly kind: 'ref'; readonly value: { current: unknown } }
  type ReducerSlot = {
    readonly kind: 'reducer'
    state: unknown
    reducer: (state: unknown, action: unknown) => unknown
    readonly dispatch: (action: unknown) => void
  }
  type HookSlot = RefSlot | ReducerSlot
  type LayoutEffect = () => void | (() => void)

  let cursor = 0
  const slots: HookSlot[] = []
  let pendingLayoutEffects: LayoutEffect[] = []

  return {
    reset() {
      cursor = 0
      slots.length = 0
      pendingLayoutEffects = []
    },
    beginRender() {
      cursor = 0
      pendingLayoutEffects = []
    },
    useLayoutEffect(effect: LayoutEffect) {
      pendingLayoutEffects.push(effect)
    },
    commitRender() {
      const effects = pendingLayoutEffects
      pendingLayoutEffects = []
      effects.forEach((effect) => effect())
    },
    useRef(initialValue: unknown) {
      const index = cursor
      cursor += 1
      const existing = slots[index]
      if (existing) {
        if (existing.kind !== 'ref') throw new Error('Hook order changed')
        return existing.value
      }
      const value = { current: initialValue }
      slots[index] = { kind: 'ref', value }
      return value
    },
    useReducer(
      reducer: (state: unknown, action: unknown) => unknown,
      initialState: unknown,
    ) {
      const index = cursor
      cursor += 1
      const existing = slots[index]
      if (existing) {
        if (existing.kind !== 'reducer') throw new Error('Hook order changed')
        existing.reducer = reducer
        return [existing.state, existing.dispatch] as const
      }
      const slot: ReducerSlot = {
        kind: 'reducer',
        state: initialState,
        reducer,
        dispatch(action) {
          slot.state = slot.reducer(slot.state, action)
        },
      }
      slots[index] = slot
      return [slot.state, slot.dispatch] as const
    },
  }
})

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useCallback: <Callback extends (...args: never[]) => unknown>(
      callback: Callback,
    ) => callback,
    useEffect: () => undefined,
    useLayoutEffect: hookHarness.useLayoutEffect,
    useReducer: hookHarness.useReducer,
    useRef: hookHarness.useRef,
  }
})

vi.mock('@react-three/fiber', () => ({
  Canvas: () => null,
  useFrame: vi.fn(),
  useThree: vi.fn(),
}))

vi.mock('../motion/gsap', () => ({
  gsap: {
    context: () => ({ revert: () => undefined }),
  },
}))

import { Canvas } from '@react-three/fiber'
import MachineCanvas, { type MachineCanvasProps } from './MachineCanvas'

class FakeActivityTarget implements AdaptiveActivityTarget {
  private readonly listeners = new Map<
    string,
    Set<EventListenerOrEventListenerObject>
  >()

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    _options?: boolean | AddEventListenerOptions,
  ) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    _options?: boolean | EventListenerOptions,
  ) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string) {
    const event = new Event(type)
    this.listeners.get(type)?.forEach((listener) => {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    })
  }
}

function createFrames() {
  let handle = 0
  const callbacks = new Map<number, () => void>()
  const scheduler: ResumeFrameScheduler = {
    request(callback) {
      handle += 1
      callbacks.set(handle, callback)
      return handle
    },
    cancel(pendingHandle) {
      if (typeof pendingHandle === 'number') callbacks.delete(pendingHandle)
    },
  }
  return { scheduler }
}

interface CanvasContractProps {
  readonly dpr: unknown
  readonly children: unknown
}

interface ManagerContractProps {
  readonly reportDpr: (dpr: number) => void
  readonly resumeGate: ReturnType<typeof createResumeActivityGate>
}

function canvasContract(value: unknown): CanvasContractProps {
  if (!isValidElement<CanvasContractProps>(value)) {
    throw new Error('MachineCanvas did not return a Canvas element')
  }
  if (value.type !== Canvas) {
    throw new Error('MachineCanvas root is not the R3F Canvas')
  }
  return value.props
}

function managerContract(children: unknown): ManagerContractProps {
  const childList = Array.isArray(children) ? children : [children]
  const manager = childList.find(
    (child): child is ReactElement<ManagerContractProps> =>
      isValidElement<ManagerContractProps>(child) &&
      typeof child.props.reportDpr === 'function',
  )
  if (!manager) throw new Error('AdaptiveDprManager binding is missing')
  return manager.props
}

describe('MachineCanvas controlled DPR contracts (not rendered Canvas proof)', () => {
  it('passes one numeric controlled DPR to Canvas and retains it across parent reconciliation', () => {
    hookHarness.reset()
    const props: MachineCanvasProps = {
      selectedCartridge: 0,
      assembly: { x: 0.12, y: 0.5, seated: false },
      onManipulationOutcome: vi.fn(),
      paused: false,
      reducedMotion: false,
      presentationBridge: {
        publish: vi.fn(),
        attach: vi.fn(() => () => undefined),
        setPaused: vi.fn(),
        replay: vi.fn(),
      },
      onReady: vi.fn(),
      onFailure: vi.fn(),
    }

    hookHarness.beginRender()
    const initialCanvas = canvasContract(MachineCanvas(props))
    expect(initialCanvas.dpr).toBe(1.5)
    expect(typeof initialCanvas.dpr).toBe('number')

    managerContract(initialCanvas.children).reportDpr(1)
    hookHarness.beginRender()
    const regressedCanvas = canvasContract(
      MachineCanvas({ ...props, onReady: vi.fn() }),
    )
    expect(regressedCanvas.dpr).toBe(1)
    expect(typeof regressedCanvas.dpr).toBe('number')

    hookHarness.beginRender()
    const reconciledCanvas = canvasContract(
      MachineCanvas({ ...props, onFailure: vi.fn() }),
    )
    expect(reconciledCanvas.dpr).toBe(1)

    managerContract(reconciledCanvas.children).reportDpr(1.5)
    hookHarness.beginRender()
    const recoveredCanvas = canvasContract(MachineCanvas(props))
    expect(recoveredCanvas.dpr).toBe(1.5)
    expect(typeof recoveredCanvas.dpr).toBe('number')
  })

  it('suppresses production-order resume reconciliation until genuine input', () => {
    const frames = createFrames()
    const gate = createResumeActivityGate(frames.scheduler)
    const target = new FakeActivityTarget()
    const onActivity = vi.fn()
    const removeActivityListeners = bindAdaptiveDprActivity(
      target,
      gate,
      onActivity,
    )
    const controller = createAdaptiveDprController({
      initialDpr: 1.5,
      initiallyPaused: true,
      gate,
      now: () => 0,
      timer: { set: () => 1, clear: () => {} },
      regress: vi.fn(),
      invalidate: vi.fn(),
      reportDpr: vi.fn(),
    })

    // Outer render arms synchronously. The parent publisher and child binding
    // are intentionally distinct and run in production order.
    gate.arm()
    const outerPublisher = {
      publishRetained() {
        if (!gate.isBlocked()) onActivity()
      },
    }
    const innerBinding = {
      resume() {
        controller.setPaused(false)
      },
    }

    outerPublisher.publishRetained()
    innerBinding.resume()
    target.dispatch('scroll')
    expect(onActivity).not.toHaveBeenCalled()

    target.dispatch('wheel')
    expect(onActivity).toHaveBeenCalledTimes(1)

    removeActivityListeners()
    controller.destroy()
    gate.destroy()
  })

  it('arms only from committed pause state after an interrupted render', () => {
    hookHarness.reset()
    const props: MachineCanvasProps = {
      selectedCartridge: 0,
      assembly: { x: 0.12, y: 0.5, seated: false },
      onManipulationOutcome: vi.fn(),
      paused: false,
      reducedMotion: false,
      presentationBridge: {
        publish: vi.fn(),
        attach: vi.fn(() => () => undefined),
        setPaused: vi.fn(),
        replay: vi.fn(),
      },
      onReady: vi.fn(),
      onFailure: vi.fn(),
    }

    hookHarness.beginRender()
    MachineCanvas(props)
    hookHarness.commitRender()

    // This paused render is abandoned before layout effects commit it.
    hookHarness.beginRender()
    MachineCanvas({ ...props, paused: true })

    hookHarness.beginRender()
    const uninterruptedCanvas = canvasContract(MachineCanvas(props))
    const gate = managerContract(uninterruptedCanvas.children).resumeGate
    expect(gate.isBlocked()).toBe(false)

    // A committed pause still arms synchronously in the following resume render.
    hookHarness.beginRender()
    MachineCanvas({ ...props, paused: true })
    hookHarness.commitRender()

    hookHarness.beginRender()
    MachineCanvas(props)
    expect(gate.isBlocked()).toBe(true)

    gate.destroy()
  })
})
