const importThreeModule = (): Promise<unknown> => import('three')

export type RallyThreeConstructor = abstract new (
  ...parameters: readonly unknown[]
) => unknown

export interface RallyThree {
  readonly WebGLRenderer: RallyThreeConstructor
  readonly Scene: RallyThreeConstructor
  readonly PerspectiveCamera: RallyThreeConstructor
  readonly Group: RallyThreeConstructor
  readonly Mesh: RallyThreeConstructor
  readonly LineSegments: RallyThreeConstructor
  readonly BufferGeometry: RallyThreeConstructor
  readonly Float32BufferAttribute: RallyThreeConstructor
  readonly SphereGeometry: RallyThreeConstructor
  readonly PlaneGeometry: RallyThreeConstructor
  readonly MeshStandardMaterial: RallyThreeConstructor
  readonly MeshBasicMaterial: RallyThreeConstructor
  readonly LineBasicMaterial: RallyThreeConstructor
  readonly AmbientLight: RallyThreeConstructor
  readonly DirectionalLight: RallyThreeConstructor
  readonly Color: RallyThreeConstructor
  readonly Vector2: RallyThreeConstructor
  readonly Vector3: RallyThreeConstructor
}

const rallyThreeMembers = [
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
] as const satisfies readonly (keyof RallyThree)[]

function threeNamespace(module: unknown): Record<string, unknown> {
  if (typeof module !== 'object' || module === null) {
    throw new TypeError('Three module does not expose a namespace')
  }

  const namespace = module as Record<string, unknown>
  if (
    rallyThreeMembers.some(
      (member) => typeof namespace[member] === 'function',
    )
  ) {
    return namespace
  }
  if (typeof namespace.default === 'object' && namespace.default !== null) {
    return namespace.default as Record<string, unknown>
  }

  throw new TypeError('Three module does not expose a namespace')
}

function threeConstructor(
  namespace: Record<string, unknown>,
  member: keyof RallyThree,
): RallyThreeConstructor {
  const constructor = namespace[member]
  if (typeof constructor !== 'function') {
    throw new TypeError(`Three module does not expose ${member}`)
  }
  return constructor as RallyThreeConstructor
}

export async function importRallyThree(
  importer: () => Promise<unknown> = importThreeModule,
): Promise<RallyThree> {
  const namespace = threeNamespace(await importer())

  return {
    WebGLRenderer: threeConstructor(namespace, 'WebGLRenderer'),
    Scene: threeConstructor(namespace, 'Scene'),
    PerspectiveCamera: threeConstructor(namespace, 'PerspectiveCamera'),
    Group: threeConstructor(namespace, 'Group'),
    Mesh: threeConstructor(namespace, 'Mesh'),
    LineSegments: threeConstructor(namespace, 'LineSegments'),
    BufferGeometry: threeConstructor(namespace, 'BufferGeometry'),
    Float32BufferAttribute: threeConstructor(
      namespace,
      'Float32BufferAttribute',
    ),
    SphereGeometry: threeConstructor(namespace, 'SphereGeometry'),
    PlaneGeometry: threeConstructor(namespace, 'PlaneGeometry'),
    MeshStandardMaterial: threeConstructor(namespace, 'MeshStandardMaterial'),
    MeshBasicMaterial: threeConstructor(namespace, 'MeshBasicMaterial'),
    LineBasicMaterial: threeConstructor(namespace, 'LineBasicMaterial'),
    AmbientLight: threeConstructor(namespace, 'AmbientLight'),
    DirectionalLight: threeConstructor(namespace, 'DirectionalLight'),
    Color: threeConstructor(namespace, 'Color'),
    Vector2: threeConstructor(namespace, 'Vector2'),
    Vector3: threeConstructor(namespace, 'Vector3'),
  }
}

export interface RallyThreeRequest<TRuntime> {
  readonly generation: number
  readonly isCurrent: (generation: number) => boolean
  readonly isCanceled: () => boolean
  readonly importThree?: () => Promise<unknown>
  readonly createRuntime: (three: RallyThree) => TRuntime
}

export type RallyThreeResult<TRuntime> =
  | { readonly status: 'created'; readonly runtime: TRuntime }
  | { readonly status: 'canceled' }
  | { readonly status: 'stale' }

export async function loadRallyThree<TRuntime>(
  request: RallyThreeRequest<TRuntime>,
): Promise<RallyThreeResult<TRuntime>> {
  let three: RallyThree

  try {
    three = await importRallyThree(request.importThree)
  } catch (error) {
    if (request.isCanceled()) return { status: 'canceled' }
    if (!request.isCurrent(request.generation)) return { status: 'stale' }
    throw error
  }

  if (request.isCanceled()) return { status: 'canceled' }
  if (!request.isCurrent(request.generation)) return { status: 'stale' }

  return {
    status: 'created',
    runtime: request.createRuntime(three),
  }
}
