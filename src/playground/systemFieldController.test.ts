import { describe, expect, it, vi } from 'vitest'
import { createSystemFieldController } from './systemFieldController'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function controllerHarness(initiallyReduced = false) {
  let reduced = initiallyReduced
  const listeners = new Set<() => void>()
  const media = {
    get matches() {
      return reduced
    },
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener)
    },
  } as MediaQueryList
  const route = {
    dataset: { systemField: 'prior', unrelated: 'preserved' },
  } as unknown as HTMLElement

  return {
    listeners,
    media,
    route,
    stage: {} as HTMLElement,
    window: {} as Window,
    setReduced(value: boolean) {
      reduced = value
      listeners.forEach((listener) => listener())
    },
  }
}

async function settle() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('System Field controller lifecycle', () => {
  it('skips reduced motion and cancels stale preference generations', async () => {
    const harness = controllerHarness(true)
    const loads: Array<{
      promise: Promise<unknown>
      resolve: (value: unknown) => void
    }> = []
    const importThree = vi.fn(() => {
      const load = deferred<unknown>()
      loads.push(load)
      return load.promise
    })
    const createRuntime = vi.fn(() => ({
      addWave: vi.fn(),
      destroy: vi.fn(),
      resize: vi.fn(),
      setProgress: vi.fn(),
    }))
    const controller = createSystemFieldController({
      ...harness,
      importThree,
      createRuntime,
    })

    expect(importThree).not.toHaveBeenCalled()
    expect(harness.route.dataset.systemField).toBe('static')
    harness.setReduced(false)
    harness.setReduced(true)
    loads[0].resolve({ id: 'stale-three' })
    await settle()
    expect(createRuntime).not.toHaveBeenCalled()
    expect(harness.route.dataset.systemField).toBe('static')

    controller.destroy()
    expect(harness.listeners.size).toBe(0)
    expect(harness.route.dataset).toMatchObject({
      systemField: 'prior',
      unrelated: 'preserved',
    })
  })

  it('publishes latest progress and falls back on context loss once', async () => {
    const harness = controllerHarness()
    const runtime = {
      addWave: vi.fn(),
      destroy: vi.fn(),
      resize: vi.fn(),
      setProgress: vi.fn(),
    }
    let loseContext!: () => void
    const controller = createSystemFieldController({
      ...harness,
      importThree: async () => ({ id: 'three' }),
      createRuntime(_three, onContextLoss) {
        loseContext = onContextLoss
        return runtime
      },
    })
    controller.setProgress(0.72, true)
    await settle()

    expect(harness.route.dataset.systemField).toBe('ready')
    expect(runtime.setProgress).toHaveBeenLastCalledWith(0.72, true)
    controller.resize()
    expect(runtime.resize).toHaveBeenCalledOnce()

    loseContext()
    loseContext()
    expect(harness.route.dataset.systemField).toBe('static')
    expect(runtime.destroy).toHaveBeenCalledOnce()

    controller.destroy()
    controller.destroy()
    expect(runtime.destroy).toHaveBeenCalledOnce()
    expect(harness.route.dataset.systemField).toBe('prior')
  })

  it('destroys a runtime canceled after construction but before adoption', async () => {
    const harness = controllerHarness()
    const runtime = {
      addWave: vi.fn(),
      destroy: vi.fn(),
      resize: vi.fn(),
      setProgress: vi.fn(),
    }
    let controller!: ReturnType<typeof createSystemFieldController>
    controller = createSystemFieldController({
      ...harness,
      importThree: async () => ({ id: 'three' }),
      createRuntime: () => {
        controller.destroy()
        return runtime
      },
    })

    await settle()

    expect(runtime.destroy).toHaveBeenCalledOnce()
    expect(runtime.setProgress).not.toHaveBeenCalled()
    expect(harness.route.dataset.systemField).toBe('prior')
    expect(harness.listeners.size).toBe(0)
  })

  it('remounts without retaining any runtime or listener ownership', async () => {
    const harness = controllerHarness()
    const runtimes: Array<{ destroy: ReturnType<typeof vi.fn> }> = []

    for (let index = 0; index < 10; index += 1) {
      const runtime = {
        addWave: vi.fn(),
        destroy: vi.fn(),
        resize: vi.fn(),
        setProgress: vi.fn(),
      }
      runtimes.push(runtime)
      const controller = createSystemFieldController({
        ...harness,
        importThree: async () => ({ id: index }),
        createRuntime: () => runtime,
      })
      await settle()
      controller.destroy()
    }

    expect(runtimes.every(({ destroy }) =>
      destroy.mock.calls.length === 1,
    )).toBe(true)
    expect(harness.listeners.size).toBe(0)
    expect(harness.route.dataset.systemField).toBe('prior')
  })
})
