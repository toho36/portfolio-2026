export const importRelayMotion = () => import('gsap')

export type RelayMotionModule = Awaited<
  ReturnType<typeof importRelayMotion>
>

export interface RelayRuntimeGate {
  issueGeneration(): number
  isCurrent(generation: number): boolean
}

export interface RelayRuntimeRequest<TModule, TRuntime> {
  readonly generation: number
  readonly isCurrent: (generation: number) => boolean
  readonly isCanceled: () => boolean
  readonly importMotion: () => Promise<TModule>
  readonly createRuntime: (motion: TModule) => TRuntime
}

export type RelayRuntimeResult<TRuntime> =
  | { readonly status: 'created'; readonly runtime: TRuntime }
  | { readonly status: 'canceled' }
  | { readonly status: 'stale' }

type DefaultRelayRuntimeRequest<TRuntime> = Omit<
  RelayRuntimeRequest<RelayMotionModule, TRuntime>,
  'importMotion'
> & {
  readonly importMotion?: undefined
}

/**
 * Issues monotonically increasing generations so callers can invalidate every
 * pending load before starting a newer preference generation.
 */
export function createRelayRuntimeGate(): RelayRuntimeGate {
  let currentGeneration = 0

  return {
    issueGeneration() {
      currentGeneration += 1
      return currentGeneration
    },
    isCurrent(generation) {
      return generation === currentGeneration
    },
  }
}

async function settleRelayRuntime<TModule, TRuntime>(
  request: RelayRuntimeRequest<TModule, TRuntime>,
): Promise<RelayRuntimeResult<TRuntime>> {
  let motion: TModule

  try {
    motion = await request.importMotion()
  } catch (error) {
    if (request.isCanceled()) return { status: 'canceled' }
    if (!request.isCurrent(request.generation)) return { status: 'stale' }
    throw error
  }

  // Cancellation wins when both conditions apply. Either check rejects the
  // request before construction; no create-then-destroy path exists.
  if (request.isCanceled()) return { status: 'canceled' }
  if (!request.isCurrent(request.generation)) return { status: 'stale' }

  return {
    status: 'created',
    runtime: request.createRuntime(motion),
  }
}

/** Uses the route-local GSAP import unless tests or callers inject an importer. */
export function loadRelayRuntime<TRuntime>(
  request: DefaultRelayRuntimeRequest<TRuntime>,
): Promise<RelayRuntimeResult<TRuntime>>
export function loadRelayRuntime<TModule, TRuntime>(
  request: RelayRuntimeRequest<TModule, TRuntime>,
): Promise<RelayRuntimeResult<TRuntime>>
export function loadRelayRuntime<TModule, TRuntime>(
  request:
    | RelayRuntimeRequest<TModule, TRuntime>
    | DefaultRelayRuntimeRequest<TRuntime>,
): Promise<RelayRuntimeResult<TRuntime>> {
  if (request.importMotion) {
    return settleRelayRuntime(
      request as RelayRuntimeRequest<TModule, TRuntime>,
    )
  }

  const defaultRequest = request as DefaultRelayRuntimeRequest<TRuntime>

  return settleRelayRuntime({
    ...defaultRequest,
    importMotion: importRelayMotion,
  })
}
