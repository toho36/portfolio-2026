export interface PosterRuntime {
  setActive(index: number): void
  setBend(amount: number): void
  destroy(): void
}

type LoadModule = { loadPosterRuntime<R>(req: { isCanceled(): boolean; onProgress(p: number): void; createRuntime(three: unknown, gsap: unknown): R | Promise<R> }): Promise<{ status: 'created'; runtime: R } | { status: 'canceled' } | { status: 'failed'; error: unknown }> }
type RuntimeModule = { createPosterRuntime(three: any, opts: { host: HTMLElement; slots: HTMLElement[]; accents: string[]; reducedMotion: boolean; onFirstFrame(): void }): PosterRuntime }

const modules = import.meta.glob(['./loadPosterRuntime.ts', './posterRuntime.ts'])

export async function loadPosterBridge(opts: { host: HTMLElement; slots: HTMLElement[]; accents: string[]; reducedMotion: boolean; isCanceled(): boolean; onFirstFrame(): void }): Promise<{ status: 'created'; runtime: PosterRuntime } | { status: 'canceled' | 'failed' | 'absent' }> {
  if (!modules['./loadPosterRuntime.ts'] || !modules['./posterRuntime.ts']) return { status: 'absent' }
  try {
    const [load, runtime] = await Promise.all([
      modules['./loadPosterRuntime.ts']() as Promise<LoadModule>,
      modules['./posterRuntime.ts']() as Promise<RuntimeModule>,
    ])
    if (opts.isCanceled()) return { status: 'canceled' }
    const result = await load.loadPosterRuntime<PosterRuntime>({
      isCanceled: opts.isCanceled,
      onProgress: () => {},
      createRuntime: (three) => runtime.createPosterRuntime(three, opts),
    })
    if (result.status === 'created') return result
    return { status: result.status }
  } catch {
    return { status: opts.isCanceled() ? 'canceled' : 'failed' }
  }
}
