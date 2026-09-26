export type PosterLoadResult<R> =
  | { status: 'created'; runtime: R }
  | { status: 'canceled' }
  | { status: 'failed'; error: unknown }

export interface PosterLoadRequest<R> {
  isCanceled(): boolean
  onProgress(p: number): void
  createRuntime(three: unknown, gsap: unknown): R | Promise<R>
  importThree?: () => Promise<unknown>
  importGsap?: () => Promise<unknown>
}

export async function loadPosterRuntime<R>(req: PosterLoadRequest<R>): Promise<PosterLoadResult<R>> {
  try {
    req.onProgress(0)
    const three = await (req.importThree ?? (() => import('three')))()
    if (req.isCanceled()) return { status: 'canceled' }
    req.onProgress(50)
    const gsap = await (req.importGsap ?? (() => import('gsap')))()
    if (req.isCanceled()) return { status: 'canceled' }
    req.onProgress(80)
    const runtime = await req.createRuntime(three, gsap)
    if (req.isCanceled()) {
      ;(runtime as { destroy?: () => void })?.destroy?.()
      return { status: 'canceled' }
    }
    req.onProgress(100)
    return { status: 'created', runtime }
  } catch (error) {
    return req.isCanceled() ? { status: 'canceled' } : { status: 'failed', error }
  }
}
