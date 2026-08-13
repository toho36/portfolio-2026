import { describe, expect, it, vi } from 'vitest'
import { importRallyThree, loadRallyThree } from './loadRallyThree'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

const REQUIRED_MEMBERS = [
  'WebGLRenderer',
  'Scene',
  'PerspectiveCamera',
  'Group',
  'Mesh',
  'LineSegments',
  'BufferGeometry',
  'Float32BufferAttribute',
  'SphereGeometry',
  'PlaneGeometry',
  'MeshStandardMaterial',
  'MeshBasicMaterial',
  'LineBasicMaterial',
  'AmbientLight',
  'DirectionalLight',
  'Color',
  'Vector2',
  'Vector3',
] as const

const validThree = {
  WebGLRenderer: class WebGLRenderer {},
  Scene: class Scene {},
  PerspectiveCamera: class PerspectiveCamera {},
  Group: class Group {},
  Mesh: class Mesh {},
  LineSegments: class LineSegments {},
  BufferGeometry: class BufferGeometry {},
  Float32BufferAttribute: class Float32BufferAttribute {},
  SphereGeometry: class SphereGeometry {},
  PlaneGeometry: class PlaneGeometry {},
  MeshStandardMaterial: class MeshStandardMaterial {},
  MeshBasicMaterial: class MeshBasicMaterial {},
  LineBasicMaterial: class LineBasicMaterial {},
  AmbientLight: class AmbientLight {},
  DirectionalLight: class DirectionalLight {},
  Color: class Color {},
  Vector2: class Vector2 {},
  Vector3: class Vector3 {},
}

describe('VoleyEvents rally Three loader', () => {
  it.each([
    ['named exports', validThree],
    ['nested default', { default: validThree }],
  ])('normalizes %s', async (_label, module) => {
    await expect(importRallyThree(async () => module)).resolves.toEqual(
      validThree,
    )
  })

  it.each([
    {},
    { WebGLRenderer: class {}, Scene: class {} },
    { ...validThree, PerspectiveCamera: {} },
  ])('rejects incomplete module shapes', async (module) => {
    await expect(importRallyThree(async () => module)).rejects.toBeInstanceOf(
      TypeError,
    )
  })

  it('returns only the exact required members', async () => {
    const facade = await importRallyThree(async () => ({
      ...validThree,
      Clock: class Clock {},
      Fog: class Fog {},
    }))

    expect(REQUIRED_MEMBERS).toHaveLength(18)
    expect(Object.keys(facade).sort()).toEqual([...REQUIRED_MEMBERS].sort())
    for (const member of REQUIRED_MEMBERS) {
      expect(facade[member]).toBe(validThree[member])
    }
  })

  it('prefers a top-level namespace containing any required constructor', async () => {
    await expect(
      importRallyThree(async () => ({
        Vector3: class Vector3 {},
        default: validThree,
      })),
    ).rejects.toHaveProperty(
      'message',
      'Three module does not expose WebGLRenderer',
    )
  })

  it.each([null, 'three', {}, { default: null }])(
    'rejects invalid namespace shape %j with the preserved message',
    async (module) => {
      const load = importRallyThree(async () => module)
      await expect(load).rejects.toBeInstanceOf(TypeError)
      await expect(load).rejects.toHaveProperty(
        'message',
        'Three module does not expose a namespace',
      )
    },
  )

  it.each(REQUIRED_MEMBERS)(
    'rejects a current module missing %s before construction',
    async (member) => {
      const createRuntime = vi.fn()
      const load = loadRallyThree({
        generation: 1,
        isCurrent: () => true,
        isCanceled: () => false,
        importThree: async () => ({ ...validThree, [member]: undefined }),
        createRuntime,
      })

      await expect(load).rejects.toBeInstanceOf(TypeError)
      await expect(load).rejects.toHaveProperty(
        'message',
        `Three module does not expose ${member}`,
      )
      expect(createRuntime).not.toHaveBeenCalled()
    },
  )

  it('rejects a non-constructor required member with the preserved message', async () => {
    const load = importRallyThree(async () => ({
      ...validThree,
      PerspectiveCamera: {},
    }))

    await expect(load).rejects.toBeInstanceOf(TypeError)
    await expect(load).rejects.toHaveProperty(
      'message',
      'Three module does not expose PerspectiveCamera',
    )
  })

  it('constructs only the current accepted generation', async () => {
    const createRuntime = vi.fn(() => ({ id: 'three-part' }))

    await expect(
      loadRallyThree({
        generation: 4,
        isCurrent: (value) => value === 4,
        isCanceled: () => false,
        importThree: async () => validThree,
        createRuntime,
      }),
    ).resolves.toEqual({
      status: 'created',
      runtime: { id: 'three-part' },
    })
    expect(createRuntime).toHaveBeenCalledWith(validThree)
  })

  it('rejects stale and canceled fulfillment before construction', async () => {
    const pending = deferred<unknown>()
    const createRuntime = vi.fn()
    let generation = 1
    let canceled = false
    const staleLoad = loadRallyThree({
      generation,
      isCurrent: (value) => value === generation,
      isCanceled: () => canceled,
      importThree: () => pending.promise,
      createRuntime,
    })

    generation = 2
    pending.resolve(validThree)
    await expect(staleLoad).resolves.toEqual({ status: 'stale' })

    canceled = true
    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: (value) => value === generation,
        isCanceled: () => canceled,
        importThree: async () => validThree,
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'canceled' })
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('lets stale and canceled fulfillment win over validation failure', async () => {
    const pending = deferred<unknown>()
    const createRuntime = vi.fn()
    let generation = 1
    let canceled = false
    const staleLoad = loadRallyThree({
      generation,
      isCurrent: (value) => value === generation,
      isCanceled: () => canceled,
      importThree: () => pending.promise,
      createRuntime,
    })

    generation = 2
    pending.resolve({ WebGLRenderer: class WebGLRenderer {} })
    await expect(staleLoad).resolves.toEqual({ status: 'stale' })

    canceled = true
    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: (value) => value === generation,
        isCanceled: () => canceled,
        importThree: async () => ({
          WebGLRenderer: class WebGLRenderer {},
        }),
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'canceled' })
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('swallows obsolete rejection but propagates current rejection', async () => {
    const failure = new Error('three unavailable')
    const createRuntime = vi.fn()
    const rejectedImport = async () => {
      throw failure
    }

    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: () => false,
        isCanceled: () => true,
        importThree: rejectedImport,
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'canceled' })
    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: () => false,
        isCanceled: () => false,
        importThree: rejectedImport,
        createRuntime,
      }),
    ).resolves.toEqual({ status: 'stale' })
    await expect(
      loadRallyThree({
        generation: 1,
        isCurrent: () => true,
        isCanceled: () => false,
        importThree: rejectedImport,
        createRuntime,
      }),
    ).rejects.toBe(failure)
    expect(createRuntime).not.toHaveBeenCalled()
  })
})
