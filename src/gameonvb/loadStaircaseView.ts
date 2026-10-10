export type StaircaseLoadResult<R> =
  | { status: 'created'; view: R }
  | { status: 'canceled' }
  | { status: 'failed'; error: unknown }

const importThreeModule = (): Promise<unknown> => import('three')

export async function loadStaircaseView<R extends { destroy(): void }>(request: {
  isCanceled(): boolean
  importThree?: () => Promise<unknown>
  createView(three: unknown): R | Promise<R>
}): Promise<StaircaseLoadResult<R>> {
  try {
    const three = await (request.importThree ?? importThreeModule)()
    if (request.isCanceled()) return { status: 'canceled' }
    const view = await request.createView(three)
    if (request.isCanceled()) { view.destroy(); return { status: 'canceled' } }
    return { status: 'created', view }
  } catch (error) {
    return request.isCanceled() ? { status: 'canceled' } : { status: 'failed', error }
  }
}
