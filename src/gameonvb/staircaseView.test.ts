import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStaircaseView } from './staircaseView'

afterEach(() => vi.unstubAllGlobals())

describe('staircase resource acquisition failure', () => {
  it('cleans the allocated renderer and attached canvas when later construction fails', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    const dispose = vi.fn(), loseContext = vi.fn()
    let attached = false
    const canvas = { setAttribute: vi.fn(), remove: vi.fn(() => { attached = false }) }
    const three = {
      WebGLRenderer: class {
        domElement = canvas
        shadowMap = {}
        setPixelRatio() {}
        dispose = dispose
        forceContextLoss = loseContext
      },
      Scene: class { constructor() { throw new Error('Scene construction failed') } },
    }
    const stage = {
      ownerDocument: { createElement: () => ({ getContext: () => ({}) }) },
      append: () => { attached = true },
    } as unknown as HTMLElement
    expect(() => createStaircaseView(three, stage)).toThrow('Scene construction failed')
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(loseContext).toHaveBeenCalledTimes(1)
    expect(canvas.remove).toHaveBeenCalledTimes(1)
    expect(attached).toBe(false)
  })
})
