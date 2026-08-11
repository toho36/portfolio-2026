const importThreeModule = (): Promise<unknown> => import('three')

export interface SystemFieldRuntimeLoaderRequest<TModule, TRuntime> {
  readonly generation: number
  readonly isCurrent: (generation: number) => boolean
  readonly isCanceled: () => boolean
  readonly importThree?: () => Promise<TModule>
  readonly createRuntime: (three: TModule) => TRuntime
}

export type SystemFieldRuntimeLoadResult<TRuntime> =
  | { readonly status: 'created'; readonly runtime: TRuntime }
  | { readonly status: 'canceled' }
  | { readonly status: 'stale' }

/** A separate loader keeps Three/WebGL failure independent from GSAP. */
export async function loadSystemFieldRuntime<TModule, TRuntime>(
  request: SystemFieldRuntimeLoaderRequest<TModule, TRuntime>,
): Promise<SystemFieldRuntimeLoadResult<TRuntime>> {
  let module: TModule
  try {
    module = await (request.importThree ?? importThreeModule)() as TModule
  } catch (error) {
    if (request.isCanceled()) return { status: 'canceled' }
    if (!request.isCurrent(request.generation)) return { status: 'stale' }
    throw error
  }

  if (request.isCanceled()) return { status: 'canceled' }
  if (!request.isCurrent(request.generation)) return { status: 'stale' }

  return {
    status: 'created',
    runtime: request.createRuntime(module),
  }
}
