export type CalibreLoadResult<R> =
  | { status: 'created'; view: R }
  | { status: 'canceled' }
  | { status: 'failed'; error: unknown }

const importThree = (): Promise<unknown> => import('three')
const importOrbit = (): Promise<unknown> => import('three/addons/controls/OrbitControls.js').then(module => module.OrbitControls)

export async function loadCalibreView<R extends { destroy(): void }>(request: {
  isCanceled(): boolean
  importThree?: () => Promise<unknown>
  importOrbit?: () => Promise<unknown>
  createView(three: unknown, orbit: unknown): R | Promise<R>
}): Promise<CalibreLoadResult<R>> {
  if (request.isCanceled()) return { status: 'canceled' }
  try {
    const [three, orbit] = await Promise.all([(request.importThree ?? importThree)(), (request.importOrbit ?? importOrbit)()])
    if (request.isCanceled()) return { status: 'canceled' }
    const view = await request.createView(three, orbit)
    if (request.isCanceled()) { view.destroy(); return { status: 'canceled' } }
    return { status: 'created', view }
  } catch (error) {
    return request.isCanceled() ? { status: 'canceled' } : { status: 'failed', error }
  }
}
