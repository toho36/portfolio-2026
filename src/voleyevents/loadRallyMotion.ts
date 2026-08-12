const importMotionCore = () => import('gsap')
const importScrollTriggerPlugin = () => import('gsap/ScrollTrigger')

type MotionCoreModule = Awaited<ReturnType<typeof importMotionCore>>
type ScrollTriggerModule = Awaited<
  ReturnType<typeof importScrollTriggerPlugin>
>

export interface RallyMotionFacade {
  readonly gsap: MotionCoreModule['gsap']
  readonly ScrollTrigger: ScrollTriggerModule['ScrollTrigger']
}

export interface RallyMotionLoaders {
  readonly loadMotionCore: () => Promise<unknown>
  readonly loadScrollTrigger: () => Promise<unknown>
}

const defaultRallyMotionLoaders: RallyMotionLoaders = {
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

function normalizeMotionCore(module: unknown): RallyMotionFacade['gsap'] {
  const gsap = moduleMember<RallyMotionFacade['gsap']>(module, 'gsap')
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
): RallyMotionFacade['ScrollTrigger'] {
  const ScrollTrigger = moduleMember<RallyMotionFacade['ScrollTrigger']>(
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

export async function importRallyMotion(
  loaders: RallyMotionLoaders = defaultRallyMotionLoaders,
): Promise<RallyMotionFacade> {
  const [motionCoreModule, scrollTriggerModule] = await Promise.all([
    loaders.loadMotionCore(),
    loaders.loadScrollTrigger(),
  ])

  return {
    gsap: normalizeMotionCore(motionCoreModule),
    ScrollTrigger: normalizeScrollTrigger(scrollTriggerModule),
  }
}

export interface RallyMotionGate {
  issueGeneration(): number
  isCurrent(generation: number): boolean
}

export function createRallyMotionGate(): RallyMotionGate {
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

export interface RallyMotionRequest<TModule, TRuntime> {
  readonly generation: number
  readonly isCurrent: (generation: number) => boolean
  readonly isCanceled: () => boolean
  readonly importMotion: () => Promise<TModule>
  readonly createRuntime: (motion: TModule) => TRuntime
}

export type RallyMotionResult<TRuntime> =
  | { readonly status: 'created'; readonly runtime: TRuntime }
  | { readonly status: 'canceled' }
  | { readonly status: 'stale' }

type DefaultRallyMotionRequest<TRuntime> = Omit<
  RallyMotionRequest<RallyMotionFacade, TRuntime>,
  'importMotion'
> & {
  readonly importMotion?: undefined
  readonly motionLoaders?: RallyMotionLoaders
}

async function settleRallyMotion<TModule, TRuntime>(
  request: RallyMotionRequest<TModule, TRuntime>,
): Promise<RallyMotionResult<TRuntime>> {
  let motion: TModule

  try {
    motion = await request.importMotion()
  } catch (error) {
    if (request.isCanceled()) return { status: 'canceled' }
    if (!request.isCurrent(request.generation)) return { status: 'stale' }
    throw error
  }

  if (request.isCanceled()) return { status: 'canceled' }
  if (!request.isCurrent(request.generation)) return { status: 'stale' }

  return {
    status: 'created',
    runtime: request.createRuntime(motion),
  }
}

export function loadRallyMotion<TRuntime>(
  request: DefaultRallyMotionRequest<TRuntime>,
): Promise<RallyMotionResult<TRuntime>>
export function loadRallyMotion<TModule, TRuntime>(
  request: RallyMotionRequest<TModule, TRuntime>,
): Promise<RallyMotionResult<TRuntime>>
export function loadRallyMotion<TModule, TRuntime>(
  request:
    | RallyMotionRequest<TModule, TRuntime>
    | DefaultRallyMotionRequest<TRuntime>,
): Promise<RallyMotionResult<TRuntime>> {
  if (request.importMotion) {
    return settleRallyMotion(
      request as RallyMotionRequest<TModule, TRuntime>,
    )
  }

  const defaultRequest = request as DefaultRallyMotionRequest<TRuntime>
  const { motionLoaders, createRuntime, ...pendingRequest } = defaultRequest

  return settleRallyMotion({
    ...pendingRequest,
    importMotion: () => importRallyMotion(motionLoaders),
    createRuntime(motion) {
      motion.gsap.registerPlugin(motion.ScrollTrigger)
      return createRuntime(motion)
    },
  })
}
