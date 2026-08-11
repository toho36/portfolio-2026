const importMotionCore = () => import('gsap')
const importScrollTriggerPlugin = () => import('gsap/ScrollTrigger')

type MotionCoreModule = Awaited<ReturnType<typeof importMotionCore>>
type ScrollTriggerModule = Awaited<
  ReturnType<typeof importScrollTriggerPlugin>
>

/** The complete motion surface exposed to the route runtime. */
export interface RelayMotionFacade {
  readonly gsap: MotionCoreModule['gsap']
  readonly ScrollTrigger: ScrollTriggerModule['ScrollTrigger']
}

/** Lazy module-loading seam used by node-environment tests. */
export interface RelayMotionLoaders {
  readonly loadMotionCore: () => Promise<unknown>
  readonly loadScrollTrigger: () => Promise<unknown>
}

const defaultRelayMotionLoaders: RelayMotionLoaders = {
  loadMotionCore: importMotionCore,
  loadScrollTrigger: importScrollTriggerPlugin,
}

function moduleMember<T>(module: unknown, member: string): T {
  if (typeof module !== 'object' || module === null) {
    throw new TypeError(`Motion module does not expose ${member}`)
  }

  const namespace = module as Record<string, unknown>
  if (Object.hasOwn(namespace, member)) {
    const namedMember = namespace[member]
    if (namedMember !== undefined && namedMember !== null) {
      return namedMember as T
    }
    throw new TypeError(`Motion module does not expose ${member}`)
  }

  const defaultExport = namespace.default
  if (typeof defaultExport === 'object' && defaultExport !== null) {
    const defaultNamespace = defaultExport as Record<string, unknown>
    if (Object.hasOwn(defaultNamespace, member)) {
      const nestedMember = defaultNamespace[member]
      if (nestedMember !== undefined && nestedMember !== null) {
        return nestedMember as T
      }
      throw new TypeError(`Motion module does not expose ${member}`)
    }
  }
  if (defaultExport !== undefined && defaultExport !== null) {
    return defaultExport as T
  }

  throw new TypeError(`Motion module does not expose ${member}`)
}

function normalizeMotionCore(module: unknown): RelayMotionFacade['gsap'] {
  const gsap = moduleMember<RelayMotionFacade['gsap']>(module, 'gsap')
  if (
    (typeof gsap !== 'object' && typeof gsap !== 'function') ||
    gsap === null ||
    typeof (gsap as { registerPlugin?: unknown }).registerPlugin !== 'function'
  ) {
    throw new TypeError('Motion module does not expose gsap')
  }
  return gsap
}

function normalizeScrollTrigger(
  module: unknown,
): RelayMotionFacade['ScrollTrigger'] {
  const ScrollTrigger = moduleMember<RelayMotionFacade['ScrollTrigger']>(
    module,
    'ScrollTrigger',
  )
  if (
    (typeof ScrollTrigger !== 'object' &&
      typeof ScrollTrigger !== 'function') ||
    ScrollTrigger === null
  ) {
    throw new TypeError('Motion module does not expose ScrollTrigger')
  }
  return ScrollTrigger
}

export async function importRelayMotion(
  loaders: RelayMotionLoaders = defaultRelayMotionLoaders,
): Promise<RelayMotionFacade> {
  const [motionCoreModule, scrollTriggerModule] = await Promise.all([
    loaders.loadMotionCore(),
    loaders.loadScrollTrigger(),
  ])

  return {
    gsap: normalizeMotionCore(motionCoreModule),
    ScrollTrigger: normalizeScrollTrigger(scrollTriggerModule),
  }
}

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
  RelayRuntimeRequest<RelayMotionFacade, TRuntime>,
  'importMotion'
> & {
  readonly importMotion?: undefined
  readonly motionLoaders?: RelayMotionLoaders
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

/** Uses the route-local motion imports unless tests or callers inject an importer. */
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
  const { motionLoaders, createRuntime, ...pendingRequest } = defaultRequest

  return settleRelayRuntime({
    ...pendingRequest,
    importMotion: () => importRelayMotion(motionLoaders),
    createRuntime(motion) {
      // GSAP's ESM core installs into its module-local scope and this app has no
      // other GSAP producer, so ScrollTrigger's global auto-discovery is inert.
      // Explicit registration is deliberately inside the accepted settle path.
      motion.gsap.registerPlugin(motion.ScrollTrigger)
      return createRuntime(motion)
    },
  })
}
