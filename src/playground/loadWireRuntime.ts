export type WireLoadResult<R> =
  | { status: 'created'; runtime: R }
  | { status: 'canceled' }
  | { status: 'failed'; error: unknown }

export interface WireLoadRequest<R> {
  isCanceled: () => boolean
  onProgress: (percent: number) => void
  importThree?: () => Promise<unknown>
  createRuntime: (three: unknown) => R | Promise<R>
}

export const importThreeModule = (): Promise<unknown> => import('three')

export async function loadWireRuntime<R>(req: WireLoadRequest<R>): Promise<WireLoadResult<R>> {
  try {
    req.onProgress(0)
    const three = await (req.importThree ?? importThreeModule)()
    if (req.isCanceled()) return { status: 'canceled' }
    req.onProgress(60)
    const runtime = await req.createRuntime(three)
    if (req.isCanceled()) {
      (runtime as { destroy?: () => void })?.destroy?.()
      return { status: 'canceled' }
    }
    req.onProgress(100)
    return { status: 'created', runtime }
  } catch (error) {
    return req.isCanceled() ? { status: 'canceled' } : { status: 'failed', error }
  }
}
